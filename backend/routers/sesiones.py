from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, date
from decimal import Decimal
from typing import Optional
import re

from database import get_db
from tz import now_col
from models import (
    CuentaUsuario, QRParqueo, SesionParqueo, FacturaV2,
    MensualidadV2, VehiculoCuenta
)
from auth import requerir_admin
from services.email_service import email_service
from services.invoice_service import invoice_service

router = APIRouter(prefix="/sesiones", tags=["Sesiones"])

TARIFA_MINUTO_CARRO = Decimal("100.00")
TARIFA_MINUTO_MOTO  = Decimal("50.00")
TARIFA_DIA_CARRO    = Decimal("30000.00")
TARIFA_DIA_MOTO     = Decimal("15000.00")

TARIFA_MINUTO = TARIFA_MINUTO_CARRO
TARIFA_DIA    = TARIFA_DIA_CARRO


def _calcular(entrada: datetime, salida: datetime, tipo_vehiculo: str = "carro") -> dict:
    delta   = salida - entrada
    minutos = max(int(delta.total_seconds() / 60), 1)
    if tipo_vehiculo == "moto":
        tarifa  = TARIFA_MINUTO_MOTO
        tope    = TARIFA_DIA_MOTO
    else:
        tarifa  = TARIFA_MINUTO_CARRO
        tope    = TARIFA_DIA_CARRO
    valor   = min(tarifa * Decimal(minutos), tope)
    horas   = minutos // 60
    mins    = minutos % 60
    desc    = f"{horas}h {mins}min" if horas else f"{mins} min"
    return {"minutos": minutos, "valor": valor, "desc": desc, "tipo_vehiculo": tipo_vehiculo}


def _num_factura(db: Session) -> str:
    total = db.query(func.count(FacturaV2.id)).scalar() or 0
    return f"FAC-{date.today().year}-{total + 1:05d}"

@router.post("/validar-qr")
async def validar_qr(datos: dict, db: Session = Depends(get_db)):
    """
    Lógica de doble escaneo QR:
    - 1er escaneo  → registra ENTRADA
    - 2do escaneo  → registra SALIDA + genera factura (visita)
    - Mensualidad  → solo entrada/salida sin cobro (si está vigente)
    """
    codigo = (datos.get("codigo") or "").strip()
    if not codigo:
        raise HTTPException(status_code=400, detail="Código QR vacío")

    qr = db.query(QRParqueo).filter(
        QRParqueo.codigo == codigo,
        QRParqueo.activo == 1,
    ).first()
    if not qr:
        raise HTTPException(status_code=404, detail="Código QR no válido o inactivo")

    cuenta        = qr.cuenta
    vehiculo      = qr.vehiculo
    placa         = vehiculo.placa if vehiculo else "SIN_PLACA"
    tipo_vehiculo = vehiculo.tipo_vehiculo if vehiculo else "carro"
    hoy           = date.today()

    sesion_activa = db.query(SesionParqueo).filter(
        SesionParqueo.qr_id == qr.id,
        SesionParqueo.estado == "activa",
    ).first()

    if qr.tipo == "mensualidad":
        mens = db.query(MensualidadV2).filter(
            MensualidadV2.cuenta_id == qr.cuenta_id,
            MensualidadV2.estado == "activa",
            MensualidadV2.fecha_inicio <= hoy,
            MensualidadV2.fecha_fin >= hoy,
        ).first()
        if not mens:
            return {
                "autorizado": False,
                "motivo":     "Mensualidad vencida o no activa para el periodo actual",
            }

        if sesion_activa:
            ahora = now_col()
            mins  = int((ahora - sesion_activa.entrada_at).total_seconds() / 60)
            sesion_activa.salida_at        = ahora
            sesion_activa.duracion_minutos = mins
            sesion_activa.valor_cobrado    = Decimal("0.00")
            sesion_activa.estado           = "completada"
            db.commit()

            total_entradas = db.query(SesionParqueo).filter(
                SesionParqueo.cuenta_id == cuenta.id,
                SesionParqueo.tipo == "mensualidad",
            ).count()

            return {
                "autorizado":    True,
                "accion":        "salida",
                "tipo":          "mensualidad",
                "tipo_vehiculo": tipo_vehiculo,
                "placa":         placa,
                "usuario":       cuenta.nombre,
                "entrada":       sesion_activa.entrada_at.isoformat(),
                "salida":        ahora.isoformat(),
                "duracion":      f"{mins} min",
                "valor":         0.0,
                "total_usos":    total_entradas,
                "mensaje":       f"✅ Salida registrada — Mensualidad activa | Usos del mes: {total_entradas}",
            }
        else:
            s = SesionParqueo(
                cuenta_id=cuenta.id, qr_id=qr.id, placa=placa,
                tipo="mensualidad", tipo_vehiculo=tipo_vehiculo,
                estado="activa", entrada_at=now_col(),
            )
            db.add(s)
            db.commit()

            # Contar entradas totales del usuario con mensualidad
            total_entradas = db.query(SesionParqueo).filter(
                SesionParqueo.cuenta_id == cuenta.id,
                SesionParqueo.tipo == "mensualidad",
            ).count()

            return {
                "autorizado":    True,
                "accion":        "entrada",
                "tipo":          "mensualidad",
                "tipo_vehiculo": tipo_vehiculo,
                "placa":         placa,
                "usuario":       cuenta.nombre,
                "entrada":       s.entrada_at.isoformat(),
                "total_usos":    total_entradas,
                "mensaje":       f"Entrada registrada — Mensualidad activa | Usos totales: {total_entradas}",
                "vencimiento":   mens.fecha_fin.isoformat(),
            }

    if sesion_activa:
        ahora = now_col()
        cobro = _calcular(sesion_activa.entrada_at, ahora, sesion_activa.tipo_vehiculo or tipo_vehiculo)

        tv_label = "Moto" if cobro.get("tipo_vehiculo") == "moto" else "Carro"
        num = _num_factura(db)
        factura = FacturaV2(
            numero=num,
            cuenta_id=cuenta.id,
            tipo="visita",
            monto=cobro["valor"],
            descripcion=f"Visita parqueadero | {tv_label} | Placa: {placa} | Tiempo: {cobro['desc']}",
            metodo_pago="efectivo",
            estado="pagada",
        )
        db.add(factura)
        db.flush()

        sesion_activa.salida_at        = ahora
        sesion_activa.duracion_minutos = cobro["minutos"]
        sesion_activa.valor_cobrado    = cobro["valor"]
        sesion_activa.estado           = "completada"
        sesion_activa.factura_id       = factura.id
        db.commit()

        try:
            pdf = invoice_service.generar_visita(
                numero=num,
                nombre_cliente=cuenta.nombre,
                doc_cliente=cuenta.documento or "",
                correo_cliente=cuenta.correo,
                placa=placa,
                entrada=sesion_activa.entrada_at,
                salida=ahora,
                duracion_str=cobro["desc"],
                minutos=cobro["minutos"],
                valor=float(cobro["valor"]),
            )
            await email_service.enviar_factura(
                correo=cuenta.correo,
                nombre=cuenta.nombre,
                doc_cliente=cuenta.documento or "",
                numero=num,
                placa=placa,
                entrada=sesion_activa.entrada_at,
                salida=ahora,
                duracion=cobro["desc"],
                minutos=cobro["minutos"],
                monto=float(cobro["valor"]),
                pdf_bytes=pdf if pdf else None,
            )
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning("Email/PDF error: %s", e)

        return {
            "autorizado":  True,
            "accion":      "salida",
            "tipo":        "visita",
            "placa":       placa,
            "usuario":     cuenta.nombre,
            "factura":     num,
            "entrada":     sesion_activa.entrada_at.isoformat(),
            "salida":      ahora.isoformat(),
            "duracion":    cobro["desc"],
            "valor":       float(cobro["valor"]),
            "mensaje":     f"Salida registrada — Total: ${cobro['valor']:,.0f} COP",
        }
    else:
        s = SesionParqueo(
            cuenta_id=cuenta.id, qr_id=qr.id, placa=placa,
            tipo="visita", tipo_vehiculo=tipo_vehiculo,
            estado="activa", entrada_at=now_col(),
        )
        db.add(s)
        db.commit()
        tv_label = "Moto" if tipo_vehiculo == "moto" else "Carro"
        return {
            "autorizado":    True,
            "accion":        "entrada",
            "tipo":          "visita",
            "tipo_vehiculo": tipo_vehiculo,
            "placa":         placa,
            "usuario":       cuenta.nombre,
            "sesion_id":     s.id,
            "entrada":       s.entrada_at.isoformat(),
            "mensaje":       f"✅ Entrada registrada ({tv_label}) — Escanea al salir para registrar el pago",
        }

@router.post("/camara-placa")
def registrar_por_placa(datos: dict, db: Session = Depends(get_db)):
    """
    Registra entrada/salida por placa (cámara OCR de seguridad).
    Body: { "placa": "ABC123" }
    """
    placa = re.sub(r"[^A-Z0-9]", "", (datos.get("placa") or "").upper().strip())
    if not re.match(r"^[A-Z]{3}[0-9]{2}[0-9A-Z]$", placa):
        raise HTTPException(status_code=400, detail=f"Placa inválida: '{placa}'")

    vehiculo = db.query(VehiculoCuenta).filter(
        VehiculoCuenta.placa == placa
    ).first()
    tipo_vehiculo = vehiculo.tipo_vehiculo if vehiculo else "carro"

    sesion_activa = db.query(SesionParqueo).filter(
        SesionParqueo.placa == placa,
        SesionParqueo.estado == "activa",
    ).first()

    if sesion_activa:
        ahora = now_col()
        cobro = _calcular(sesion_activa.entrada_at, ahora, sesion_activa.tipo_vehiculo or tipo_vehiculo)

        cuenta_id = sesion_activa.cuenta_id
        if cuenta_id:
            num     = _num_factura(db)
            factura = FacturaV2(
                numero=num,
                cuenta_id=cuenta_id,
                tipo="visita",
                monto=cobro["valor"],
                descripcion=f"Salida por cámara | Placa: {placa} | {cobro['desc']}",
                metodo_pago="efectivo",
                estado="pagada",
            )
            db.add(factura)
            db.flush()
            sesion_activa.factura_id = factura.id

        sesion_activa.salida_at        = ahora
        sesion_activa.duracion_minutos = cobro["minutos"]
        sesion_activa.valor_cobrado    = cobro["valor"]
        sesion_activa.estado           = "completada"
        db.commit()

        return {
            "accion":   "salida",
            "placa":    placa,
            "entrada":  sesion_activa.entrada_at.isoformat(),
            "salida":   ahora.isoformat(),
            "duracion": cobro["desc"],
            "valor":    float(cobro["valor"]),
            "usuario":  vehiculo.cuenta.nombre if vehiculo else "visitante",
            "mensaje":  f"Salida — Total: ${cobro['valor']:,.0f} COP",
        }
    else:
        s = SesionParqueo(
            cuenta_id=vehiculo.cuenta_id if vehiculo else None,
            placa=placa,
            tipo="camara",
            tipo_vehiculo=tipo_vehiculo,
            estado="activa",
            entrada_at=now_col(),
        )
        db.add(s)
        db.commit()
        tv_label = "Moto" if tipo_vehiculo == "moto" else "Carro"
        return {
            "accion":        "entrada",
            "tipo_vehiculo": tipo_vehiculo,
            "placa":         placa,
            "sesion_id":     s.id,
            "entrada":       s.entrada_at.isoformat(),
            "usuario":       vehiculo.cuenta.nombre if vehiculo else "visitante",
            "registrado":    vehiculo is not None,
            "mensaje":       f"Entrada registrada por cámara ({tv_label})",
        }

@router.get("/activas")
def sesiones_activas(
    _: CuentaUsuario = Depends(requerir_admin),
    db: Session = Depends(get_db),
):
    """Lista todas las sesiones activas (admin)."""
    sesiones = db.query(SesionParqueo).filter(
        SesionParqueo.estado == "activa"
    ).order_by(SesionParqueo.entrada_at.asc()).all()

    ahora = now_col()
    result = []
    for s in sesiones:
        mins = max(int((ahora - s.entrada_at).total_seconds() / 60), 1)
        tv   = s.tipo_vehiculo or "carro"
        if s.tipo == "mensualidad":
            cobro_actual = 0.0
        elif tv == "moto":
            cobro_actual = float(min(TARIFA_MINUTO_MOTO * Decimal(mins), TARIFA_DIA_MOTO))
        else:
            cobro_actual = float(min(TARIFA_MINUTO_CARRO * Decimal(mins), TARIFA_DIA_CARRO))
        result.append({
            "id":            s.id,
            "placa":         s.placa,
            "tipo":          s.tipo,
            "tipo_vehiculo": tv,
            "entrada":       s.entrada_at.isoformat(),
            "minutos":       int((ahora - s.entrada_at).total_seconds() / 60),
            "cobro_actual":  cobro_actual,
            "usuario":       s.cuenta.nombre if s.cuenta else "visitante",
        })
    return result

@router.get("/historial")
def historial_admin(
    skip: int = 0,
    limit: int = 100,
    _: CuentaUsuario = Depends(requerir_admin),
    db: Session = Depends(get_db),
):
    sesiones = (
        db.query(SesionParqueo)
        .order_by(SesionParqueo.entrada_at.desc())
        .offset(skip).limit(limit)
        .all()
    )
    return [
        {
            "id":            s.id,
            "placa":         s.placa,
            "tipo":          s.tipo,
            "entrada":       s.entrada_at.isoformat(),
            "salida":        s.salida_at.isoformat() if s.salida_at else None,
            "duracion":      s.duracion_minutos,
            "valor":         float(s.valor_cobrado) if s.valor_cobrado is not None else None,
            "estado":        s.estado,
            "usuario":       s.cuenta.nombre if s.cuenta else "visitante",
            "factura_id":    s.factura_id,
            "factura_numero": s.factura.numero if s.factura_id and s.factura else None,
        }
        for s in sesiones
    ]