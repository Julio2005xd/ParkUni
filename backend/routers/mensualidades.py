from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from typing import List
from datetime import date, datetime, timedelta

from database import get_db
from tz import now_col
from models import Mensualidad, UsuarioRegistrado, Ingreso, Pago
from schemas import MensualidadCreate, MensualidadOut

router = APIRouter(prefix="/mensualidades", tags=["Mensualidades"])


@router.post("/", response_model=MensualidadOut, status_code=201)
def registrar_mensualidad(datos: MensualidadCreate, db: Session = Depends(get_db)):
    """Registra o actualiza una mensualidad para un usuario."""
    usuario = db.query(UsuarioRegistrado).filter(
        UsuarioRegistrado.id == datos.usuario_id
    ).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    existente = db.query(Mensualidad).filter(
        Mensualidad.usuario_id == datos.usuario_id,
        Mensualidad.periodo == datos.periodo
    ).first()

    if existente:
        existente.estado_pago = datos.estado_pago
        existente.fecha_vencimiento = datos.fecha_vencimiento
        db.commit()
        db.refresh(existente)
        return existente

    mensualidad = Mensualidad(**datos.model_dump())
    db.add(mensualidad)
    db.commit()
    db.refresh(mensualidad)
    return mensualidad

@router.get("/validar/{documento}")
def validar_mensualidad(documento: str, db: Session = Depends(get_db)):
    from models import Persona
    persona = db.query(Persona).filter(Persona.documento == documento).first()
    if not persona or not persona.usuario:
        return {"valida": False, "motivo": "Usuario no registrado en el sistema"}

    periodo_actual = date.today().strftime("%Y-%m")
    mensualidad = db.query(Mensualidad).filter(
        Mensualidad.usuario_id == persona.usuario.id,
        Mensualidad.periodo == periodo_actual,
        Mensualidad.estado_pago == "activo"
    ).first()

    if not mensualidad:
        return {
            "valida": False,
            "motivo": f"Sin mensualidad activa para {periodo_actual}",
            "documento": documento
        }

    return {
        "valida": True,
        "usuario": persona.nombre,
        "rol": persona.usuario.rol,
        "periodo": mensualidad.periodo,
        "vencimiento": mensualidad.fecha_vencimiento.isoformat(),
        "documento": documento
    }

@router.get("/usuario/{usuario_id}", response_model=List[MensualidadOut])
def mensualidades_usuario(usuario_id: int, db: Session = Depends(get_db)):
    return db.query(Mensualidad).filter(
        Mensualidad.usuario_id == usuario_id
    ).order_by(Mensualidad.periodo.desc()).all()


reportes_router = APIRouter(prefix="/reportes", tags=["Reportes"])


@reportes_router.get("/ingresos-dia")
def reporte_ingresos_dia(fecha: str | None = None, db: Session = Depends(get_db)):
    """Reporte de ingresos agrupados por día (últimos 30 días si no se especifica fecha)."""
    if fecha:
        fecha_inicio = datetime.strptime(fecha, "%Y-%m-%d")
        fecha_fin = fecha_inicio + timedelta(days=1)
    else:
        fecha_fin = now_col()
        fecha_inicio = fecha_fin - timedelta(days=30)

    resultado = (
        db.query(
            func.date(Ingreso.fecha_hora_entrada).label("fecha"),
            func.count(Ingreso.id).label("total_ingresos"),
        )
        .filter(
            Ingreso.fecha_hora_entrada.between(fecha_inicio, fecha_fin)
        )
        .group_by(func.date(Ingreso.fecha_hora_entrada))
        .order_by(func.date(Ingreso.fecha_hora_entrada))
        .all()
    )

    return [
        {"fecha": str(r.fecha), "total_ingresos": r.total_ingresos}
        for r in resultado
    ]

@reportes_router.get("/recaudo-dia")
def reporte_recaudo_dia(db: Session = Depends(get_db)):
    """Recaudo total por día (últimos 30 días)."""
    fecha_inicio = now_col() - timedelta(days=30)

    resultado = (
        db.query(
            func.date(Pago.fecha_pago).label("fecha"),
            func.sum(Pago.monto).label("total_recaudado"),
            func.count(Pago.id).label("num_pagos")
        )
        .filter(
            Pago.fecha_pago >= fecha_inicio,
            Pago.estado == "completado"
        )
        .group_by(func.date(Pago.fecha_pago))
        .order_by(func.date(Pago.fecha_pago))
        .all()
    )

    return [
        {
            "fecha": str(r.fecha),
            "total_recaudado": float(r.total_recaudado or 0),
            "num_pagos": r.num_pagos
        }
        for r in resultado
    ]


@reportes_router.get("/resumen")
def resumen_general(db: Session = Depends(get_db)):
    """Resumen general del parqueadero para el dashboard."""
    hoy = date.today()

    ingresos_hoy = db.query(func.count(Ingreso.id)).filter(
        func.date(Ingreso.fecha_hora_entrada) == hoy
    ).scalar() or 0

    activos_ahora = db.query(func.count(Ingreso.id)).filter(
        Ingreso.estado == "activo"
    ).scalar() or 0

    recaudo_hoy = db.query(func.sum(Pago.monto)).filter(
        func.date(Pago.fecha_pago) == hoy,
        Pago.estado == "completado"
    ).scalar() or 0

    total_usuarios = db.query(func.count(UsuarioRegistrado.id)).scalar() or 0

    return {
        "ingresos_hoy":     ingresos_hoy,
        "vehiculos_activos": activos_ahora,
        "recaudo_hoy":      float(recaudo_hoy),
        "total_usuarios":   total_usuarios,
        "fecha":            hoy.isoformat()
    }
