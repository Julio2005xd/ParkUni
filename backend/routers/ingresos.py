"""
routers/ingresos.py — Control de ingreso y salida vehicular
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List
from datetime import datetime

from database import get_db
from tz import now_col
from models import (
    Ingreso, Vehiculo, Persona, UsuarioRegistrado,
    CodigoQR, Mensualidad, Pago, Alerta, Auditoria
)
from schemas import IngresoOut, IngresoCreate, IngresoSalida, OcupacionOut
from services.ocr_service import ocr_service
from services.cobro_service import cobro_service

router = APIRouter(prefix="/ingresos", tags=["Ingresos"])


def _registrar_auditoria(db: Session, accion: str, registro_id: int, detalle: str):
    db.add(Auditoria(
        accion=accion,
        tabla_afectada="ingresos",
        registro_id=registro_id,
        detalle=detalle
    ))


# ──────────────────────────────────────────────────────────────
#  POST /ingresos/validar-qr  ← flujo usuario registrado
# ──────────────────────────────────────────────────────────────
@router.post("/validar-qr")
def validar_ingreso_qr(datos: dict, db: Session = Depends(get_db)):
    """
    Valida QR → verifica mensualidad → registra ingreso.
    Body: { "codigo": "PKG-1-XXXXXX" }
    """
    codigo = datos.get("codigo", "")

    # 1. Buscar QR activo
    qr = db.query(CodigoQR).filter(
        CodigoQR.codigo == codigo,
        CodigoQR.estado == "activo"
    ).first()
    if not qr:
        raise HTTPException(status_code=401, detail="Código QR inválido o expirado")

    # 2. Verificar mensualidad del usuario
    from datetime import date
    periodo_actual = date.today().strftime("%Y-%m")
    mensualidad = db.query(Mensualidad).filter(
        Mensualidad.usuario_id == qr.usuario_id,
        Mensualidad.periodo == periodo_actual,
        Mensualidad.estado_pago == "activo"
    ).first()

    if not mensualidad:
        return {
            "autorizado": False,
            "motivo": "Mensualidad vencida o no registrada para el período actual",
            "periodo": periodo_actual
        }

    # 3. Obtener vehículo del usuario
    vehiculo = db.query(Vehiculo).join(Persona).join(UsuarioRegistrado).filter(
        UsuarioRegistrado.id == qr.usuario_id
    ).first()
    if not vehiculo:
        raise HTTPException(status_code=404, detail="Usuario no tiene vehículo registrado")

    # 4. Verificar que no tenga ingreso activo
    ingreso_activo = db.query(Ingreso).filter(
        Ingreso.vehiculo_id == vehiculo.id,
        Ingreso.estado == "activo"
    ).first()
    if ingreso_activo:
        return {"autorizado": False, "motivo": "Vehículo ya se encuentra dentro del parqueadero"}

    # 5. Registrar ingreso
    ingreso = Ingreso(
        vehiculo_id=vehiculo.id,
        tipo_usuario="registrado",
        estado="activo",
        fecha_hora_entrada=now_col()
    )
    db.add(ingreso)
    qr.estado = "usado"
    db.flush()

    _registrar_auditoria(db, "INGRESO_QR", ingreso.id,
                         f"Placa {vehiculo.placa} ingresó via QR")
    db.commit()

    return {
        "autorizado": True,
        "ingreso_id": ingreso.id,
        "placa": vehiculo.placa,
        "usuario": vehiculo.persona.nombre,
        "hora_entrada": ingreso.fecha_hora_entrada.isoformat(),
        "mensaje": "Acceso autorizado ✓"
    }


# ──────────────────────────────────────────────────────────────
#  POST /ingresos/placa  ← detecta placa vía OCR
# ──────────────────────────────────────────────────────────────
@router.post("/placa")
async def ingresar_por_placa(
    imagen: UploadFile = File(...),
    tipo_usuario: str = Form("visitante"),
    db: Session = Depends(get_db)
):
    """
    Recibe imagen de cámara, extrae placa con OCR y registra ingreso.
    """
    imagen_bytes = await imagen.read()
    resultado_ocr = ocr_service.procesar_imagen_bytes(imagen_bytes)

    if not resultado_ocr.get("placa_detectada"):
        return {
            "autorizado": False,
            "motivo": "No se pudo detectar la placa en la imagen",
            "ocr_raw": resultado_ocr.get("texto_raw", ""),
        }

    placa = resultado_ocr["placa_detectada"]

    # Buscar vehículo
    vehiculo = db.query(Vehiculo).filter(Vehiculo.placa == placa).first()
    if not vehiculo:
        return {
            "autorizado": False,
            "placa_detectada": placa,
            "motivo": "Placa no registrada en el sistema",
            "confianza": resultado_ocr["confianza"]
        }

    # Verificar ingreso activo duplicado
    activo = db.query(Ingreso).filter(
        Ingreso.vehiculo_id == vehiculo.id,
        Ingreso.estado == "activo"
    ).first()
    if activo:
        return {"autorizado": False, "motivo": "Vehículo ya está dentro del parqueadero"}

    ingreso = Ingreso(
        vehiculo_id=vehiculo.id,
        tipo_usuario=tipo_usuario,
        estado="activo",
        fecha_hora_entrada=now_col()
    )
    db.add(ingreso)
    db.flush()
    _registrar_auditoria(db, "INGRESO_OCR", ingreso.id, f"Placa {placa} detectada por OCR")
    db.commit()

    return {
        "autorizado": True,
        "ingreso_id": ingreso.id,
        "placa": placa,
        "confianza_ocr": resultado_ocr["confianza"],
        "hora_entrada": ingreso.fecha_hora_entrada.isoformat(),
    }


# ──────────────────────────────────────────────────────────────
#  POST /ingresos/salida  ← registra salida y genera cobro
# ──────────────────────────────────────────────────────────────
@router.post("/salida")
def registrar_salida(datos: IngresoSalida, db: Session = Depends(get_db)):
    """Registra la salida del vehículo y calcula el cobro."""
    ingreso = db.query(Ingreso).filter(
        Ingreso.id == datos.ingreso_id,
        Ingreso.estado == "activo"
    ).first()
    if not ingreso:
        raise HTTPException(status_code=404, detail="Ingreso activo no encontrado")

    ahora = now_col()
    resultado = cobro_service.calcular_cobro(
        ingreso.fecha_hora_entrada,
        ahora,
        ingreso.tipo_usuario
    )

    ingreso.fecha_hora_salida = ahora
    ingreso.minutos_estadia = resultado["minutos"]
    ingreso.valor_cobrado = resultado["valor"]
    ingreso.estado = "completado"

    pago = Pago(
        ingreso_id=ingreso.id,
        monto=resultado["valor"],
        metodo=datos.metodo_pago,
        estado="completado"
    )
    db.add(pago)
    _registrar_auditoria(db, "SALIDA", ingreso.id,
                         f"Cobro: ${resultado['valor']} | {resultado['descripcion']}")
    db.commit()

    return {
        "ingreso_id": ingreso.id,
        "placa": ingreso.vehiculo.placa,
        "entrada": ingreso.fecha_hora_entrada.isoformat(),
        "salida": ahora.isoformat(),
        "minutos": resultado["minutos"],
        "valor_cobrado": float(resultado["valor"]),
        "descripcion": resultado["descripcion"],
        "tipo_cobro": resultado["tipo_cobro"],
        "metodo_pago": datos.metodo_pago
    }


# ──────────────────────────────────────────────────────────────
#  GET /ingresos/activos
# ──────────────────────────────────────────────────────────────
@router.get("/activos", response_model=List[dict])
def listar_activos(db: Session = Depends(get_db)):
    """Lista todos los vehículos actualmente en el parqueadero."""
    ingresos = db.query(Ingreso).filter(Ingreso.estado == "activo").all()
    resultado = []
    for i in ingresos:
        minutos_actual = int(
            (now_col() - i.fecha_hora_entrada).total_seconds() / 60
        )
        cobro_actual = cobro_service.calcular_cobro_actual(
            i.fecha_hora_entrada, i.tipo_usuario
        )
        resultado.append({
            "ingreso_id":       i.id,
            "placa":            i.vehiculo.placa,
            "propietario":      i.vehiculo.persona.nombre,
            "tipo_usuario":     i.tipo_usuario,
            "fecha_hora_entrada": i.fecha_hora_entrada.isoformat(),
            "minutos_actuales": minutos_actual,
            "cobro_actual":     float(cobro_actual["valor"]),
        })
    return resultado


# ──────────────────────────────────────────────────────────────
#  GET /ingresos/ocupacion
# ──────────────────────────────────────────────────────────────
@router.get("/ocupacion", response_model=OcupacionOut)
def ocupacion(db: Session = Depends(get_db)):
    """Retorna la ocupación actual del parqueadero."""
    result = db.execute(text("SELECT * FROM vista_ocupacion")).first()
    total     = result[0] if result else 100
    ocupados  = result[1] if result else 0
    disponibles = result[2] if result else 100
    porcentaje  = round((ocupados / total) * 100, 1) if total else 0.0
    return OcupacionOut(
        capacidad_total=total,
        ocupados=ocupados,
        disponibles=disponibles,
        porcentaje=porcentaje
    )


# ──────────────────────────────────────────────────────────────
#  GET /ingresos/historial
# ──────────────────────────────────────────────────────────────
@router.get("/historial", response_model=List[dict])
def historial(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Historial paginado de todos los ingresos."""
    ingresos = (
        db.query(Ingreso)
        .order_by(Ingreso.fecha_hora_entrada.desc())
        .offset(skip).limit(limit).all()
    )
    return [
        {
            "id":               i.id,
            "placa":            i.vehiculo.placa,
            "propietario":      i.vehiculo.persona.nombre,
            "entrada":          i.fecha_hora_entrada.isoformat(),
            "salida":           i.fecha_hora_salida.isoformat() if i.fecha_hora_salida else None,
            "estado":           i.estado,
            "minutos":          i.minutos_estadia,
            "valor_cobrado":    float(i.valor_cobrado) if i.valor_cobrado else None,
            "tipo_usuario":     i.tipo_usuario,
        }
        for i in ingresos
    ]
