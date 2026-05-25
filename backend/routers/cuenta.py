from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
import re

from database import get_db
from models import CuentaUsuario, VehiculoCuenta, QRParqueo, SesionParqueo, FacturaV2, MensualidadV2
from auth import obtener_cuenta_actual
from services.qr_service import qr_service
from services.invoice_service import invoice_service

router = APIRouter(prefix="/cuenta", tags=["Mi Cuenta"])

class VehiculoIn(BaseModel):
    placa:          str
    marca:          Optional[str] = None
    modelo:         Optional[str] = None
    color:          Optional[str] = None
    tipo_vehiculo:  Optional[str] = "carro"

class PerfilUpdate(BaseModel):
    nombre:    Optional[str] = None
    telefono:  Optional[str] = None
    documento: Optional[str] = None

def _normalizar_placa(placa: str) -> str:
    p = re.sub(r"[^A-Z0-9]", "", placa.upper().strip())
    if not re.match(r"^[A-Z]{3}[0-9]{2}[0-9A-Z]$", p):
        raise HTTPException(
            status_code=400,
            detail="Formato de placa inválido. Ejemplos válidos: ABC123, ABC12D"
        )
    return p

@router.get("/perfil")
def perfil(cuenta: CuentaUsuario = Depends(obtener_cuenta_actual)):
    return {
        "id":        cuenta.id,
        "nombre":    cuenta.nombre,
        "correo":    cuenta.correo,
        "documento": cuenta.documento,
        "telefono":  cuenta.telefono,
        "rol":       cuenta.rol,
    }

@router.put("/perfil")
def actualizar_perfil(
    datos: PerfilUpdate,
    cuenta: CuentaUsuario = Depends(obtener_cuenta_actual),
    db: Session = Depends(get_db),
):
    if datos.nombre:
        cuenta.nombre = datos.nombre.strip()
    if datos.telefono is not None:
        cuenta.telefono = datos.telefono
    if datos.documento is not None:
        existing = db.query(CuentaUsuario).filter(
            CuentaUsuario.documento == datos.documento,
            CuentaUsuario.id != cuenta.id,
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Documento ya registrado")
        cuenta.documento = datos.documento
    db.commit()
    return {"mensaje": "Perfil actualizado correctamente"}

@router.get("/vehiculo")
def obtener_vehiculo(
    cuenta: CuentaUsuario = Depends(obtener_cuenta_actual),
    db: Session = Depends(get_db),
):
    v = db.query(VehiculoCuenta).filter(
        VehiculoCuenta.cuenta_id == cuenta.id
    ).first()
    if not v:
        return {"vehiculo": None}
    return {
        "vehiculo": {
            "id": v.id, "placa": v.placa, "marca": v.marca,
            "modelo": v.modelo, "color": v.color,
            "tipo_vehiculo": v.tipo_vehiculo or "carro",
        }
    }

@router.post("/vehiculo", status_code=201)
def registrar_vehiculo(
    datos: VehiculoIn,
    cuenta: CuentaUsuario = Depends(obtener_cuenta_actual),
    db: Session = Depends(get_db),
):
    placa = _normalizar_placa(datos.placa)

    existente = db.query(VehiculoCuenta).filter(
        VehiculoCuenta.cuenta_id == cuenta.id
    ).first()
    if existente:
        raise HTTPException(
            status_code=400,
            detail="Ya tienes un vehículo registrado. Elimínalo primero para registrar otro."
        )

    if db.query(VehiculoCuenta).filter(VehiculoCuenta.placa == placa).first():
        raise HTTPException(status_code=400, detail="La placa ya está registrada en el sistema")

    tipo_v = datos.tipo_vehiculo if datos.tipo_vehiculo in ("carro", "moto") else "carro"
    v = VehiculoCuenta(
        cuenta_id=cuenta.id,
        placa=placa,
        marca=datos.marca,
        modelo=datos.modelo,
        color=datos.color,
        tipo_vehiculo=tipo_v,
    )
    db.add(v)
    db.commit()
    db.refresh(v)
    return {"mensaje": "Vehículo registrado", "vehiculo_id": v.id, "placa": v.placa, "tipo_vehiculo": v.tipo_vehiculo}

@router.put("/vehiculo")
def actualizar_vehiculo(
    datos: VehiculoIn,
    cuenta: CuentaUsuario = Depends(obtener_cuenta_actual),
    db: Session = Depends(get_db),
):
    v = db.query(VehiculoCuenta).filter(
        VehiculoCuenta.cuenta_id == cuenta.id
    ).first()
    if not v:
        raise HTTPException(status_code=404, detail="No tienes vehículo registrado")

    placa = _normalizar_placa(datos.placa)
    if placa != v.placa:
        if db.query(VehiculoCuenta).filter(
            VehiculoCuenta.placa == placa,
            VehiculoCuenta.id != v.id,
        ).first():
            raise HTTPException(status_code=400, detail="Placa ya registrada en el sistema")
    v.placa         = placa
    v.marca         = datos.marca
    v.modelo        = datos.modelo
    v.color         = datos.color
    v.tipo_vehiculo = datos.tipo_vehiculo if datos.tipo_vehiculo in ("carro", "moto") else "carro"
    db.commit()
    return {"mensaje": "Vehículo actualizado", "placa": v.placa, "tipo_vehiculo": v.tipo_vehiculo}

@router.get("/qr")
def obtener_qr(
    cuenta: CuentaUsuario = Depends(obtener_cuenta_actual),
    db: Session = Depends(get_db),
):
    """Obtiene el QR de visita activo de la cuenta (o nulo)."""
    v = db.query(VehiculoCuenta).filter(VehiculoCuenta.cuenta_id == cuenta.id).first()
    if not v:
        return {"qr": None, "motivo": "Primero registra tu vehículo"}

    qr = db.query(QRParqueo).filter(
        QRParqueo.vehiculo_id == v.id,
        QRParqueo.tipo == "visita",
        QRParqueo.activo == 1,
    ).first()

    if not qr:
        return {"qr": None, "motivo": "No tienes QR generado. Pulsa 'Generar QR'."}

    return {
        "qr": {
            "id":         qr.id,
            "codigo":     qr.codigo,
            "tipo":       qr.tipo,
            "imagen_b64": qr.imagen_b64,
            "creado_en":  qr.creado_en.isoformat(),
        }
    }

@router.post("/qr/generar", status_code=201)
def generar_qr(
    cuenta: CuentaUsuario = Depends(obtener_cuenta_actual),
    db: Session = Depends(get_db),
):
    """Genera un nuevo QR de visita para la cuenta (desactiva el anterior)."""
    v = db.query(VehiculoCuenta).filter(VehiculoCuenta.cuenta_id == cuenta.id).first()
    if not v:
        raise HTTPException(status_code=400, detail="Registra tu vehículo antes de generar el QR")

    db.query(QRParqueo).filter(
        QRParqueo.cuenta_id == cuenta.id,
        QRParqueo.tipo == "visita",
        QRParqueo.activo == 1,
    ).update({"activo": 0})

    codigo  = qr_service.generar_codigo_unico(cuenta.id)
    img_b64 = qr_service.generar_imagen_qr(codigo, cuenta.nombre)

    qr = QRParqueo(
        cuenta_id=cuenta.id,
        vehiculo_id=v.id,
        codigo=codigo,
        tipo="visita",
        activo=1,
        imagen_b64=img_b64,
    )
    db.add(qr)
    db.commit()
    db.refresh(qr)

    return {
        "mensaje":    "QR generado correctamente",
        "codigo":     qr.codigo,
        "imagen_b64": qr.imagen_b64,
    }

@router.get("/sesiones")
def historial_sesiones(
    skip: int = 0,
    limit: int = 50,
    cuenta: CuentaUsuario = Depends(obtener_cuenta_actual),
    db: Session = Depends(get_db),
):
    sesiones = (
        db.query(SesionParqueo)
        .filter(SesionParqueo.cuenta_id == cuenta.id)
        .order_by(SesionParqueo.entrada_at.desc())
        .offset(skip).limit(limit)
        .all()
    )
    return [
        {
            "id":          s.id,
            "placa":       s.placa,
            "tipo":        s.tipo,
            "entrada_at":  s.entrada_at.isoformat(),
            "salida_at":   s.salida_at.isoformat() if s.salida_at else None,
            "duracion":    s.duracion_minutos,
            "valor":       float(s.valor_cobrado) if s.valor_cobrado is not None else None,
            "estado":      s.estado,
            "factura_id":  s.factura_id,
        }
        for s in sesiones
    ]

@router.get("/facturas")
def mis_facturas(
    skip: int = 0,
    limit: int = 50,
    cuenta: CuentaUsuario = Depends(obtener_cuenta_actual),
    db: Session = Depends(get_db),
):
    facturas = (
        db.query(FacturaV2)
        .filter(FacturaV2.cuenta_id == cuenta.id)
        .order_by(FacturaV2.fecha_emision.desc())
        .offset(skip).limit(limit)
        .all()
    )
    return [
        {
            "id":            f.id,
            "numero":        f.numero,
            "tipo":          f.tipo,
            "monto":         float(f.monto),
            "descripcion":   f.descripcion,
            "metodo_pago":   f.metodo_pago,
            "estado":        f.estado,
            "fecha_emision": f.fecha_emision.isoformat(),
        }
        for f in facturas
    ]

@router.get("/facturas/{factura_id}/pdf")
def descargar_mi_factura_pdf(
    factura_id: int,
    cuenta: CuentaUsuario = Depends(obtener_cuenta_actual),
    db: Session = Depends(get_db),
):
    """El usuario descarga su propia factura en PDF."""
    factura = db.query(FacturaV2).filter(
        FacturaV2.id == factura_id,
        FacturaV2.cuenta_id == cuenta.id,  # solo sus facturas
    ).first()
    if not factura:
        raise HTTPException(status_code=404, detail="Factura no encontrada")

    if factura.tipo == "visita":
        sesion = db.query(SesionParqueo).filter(
            SesionParqueo.factura_id == factura.id
        ).first()
        pdf = invoice_service.generar_visita(
            numero=factura.numero,
            nombre_cliente=cuenta.nombre,
            doc_cliente=cuenta.documento or "",
            correo_cliente=cuenta.correo,
            placa=sesion.placa if sesion else "N/A",
            entrada=sesion.entrada_at if sesion else factura.fecha_emision,
            salida=sesion.salida_at if sesion else factura.fecha_emision,
            duracion_str=f"{sesion.duracion_minutos} min" if sesion else "N/A",
            minutos=sesion.duracion_minutos if sesion else 0,
            valor=float(factura.monto),
        )
    else:
        mens = db.query(MensualidadV2).filter(
            MensualidadV2.factura_id == factura.id
        ).first()
        pdf = invoice_service.generar_mensualidad(
            numero=factura.numero,
            nombre_cliente=cuenta.nombre,
            doc_cliente=cuenta.documento or "",
            correo_cliente=cuenta.correo,
            periodo=mens.periodo if mens else "N/A",
            fecha_inicio=str(mens.fecha_inicio) if mens else "N/A",
            fecha_fin=str(mens.fecha_fin) if mens else "N/A",
            monto=float(factura.monto),
        )

    if not pdf:
        raise HTTPException(status_code=500, detail="Error generando PDF")

    return StreamingResponse(
        iter([pdf]),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="Factura_{factura.numero}.pdf"'},
    )