"""
routers/usuarios.py — CRUD de usuarios registrados
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models import Persona, UsuarioRegistrado, Vehiculo, CodigoQR
from schemas import UsuarioCreate, UsuarioOut, VehiculoCreate, VehiculoOut, QROut
from services.qr_service import qr_service

router = APIRouter(prefix="/usuarios", tags=["Usuarios"])


@router.post("/", response_model=UsuarioOut, status_code=status.HTTP_201_CREATED)
def crear_usuario(datos: UsuarioCreate, db: Session = Depends(get_db)):
    """Registra un nuevo usuario (estudiante / docente / administrativo)."""
    # Verificar documento único
    if db.query(Persona).filter(Persona.documento == datos.documento).first():
        raise HTTPException(
            status_code=400,
            detail=f"Ya existe un usuario con documento {datos.documento}"
        )

    persona = Persona(
        nombre=datos.nombre,
        documento=datos.documento,
        correo=datos.correo,
        telefono=datos.telefono,
    )
    db.add(persona)
    db.flush()

    usuario = UsuarioRegistrado(
        persona_id=persona.id,
        rol=datos.rol,
        estado_activo=1,
    )
    db.add(usuario)
    db.commit()
    db.refresh(usuario)
    return usuario


@router.get("/", response_model=List[UsuarioOut])
def listar_usuarios(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    """Lista todos los usuarios registrados."""
    return (
        db.query(UsuarioRegistrado)
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.get("/{usuario_id}", response_model=UsuarioOut)
def obtener_usuario(usuario_id: int, db: Session = Depends(get_db)):
    usuario = db.query(UsuarioRegistrado).filter(
        UsuarioRegistrado.id == usuario_id
    ).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return usuario


@router.get("/documento/{documento}", response_model=UsuarioOut)
def buscar_por_documento(documento: str, db: Session = Depends(get_db)):
    persona = db.query(Persona).filter(Persona.documento == documento).first()
    if not persona or not persona.usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return persona.usuario


@router.put("/{usuario_id}/desactivar")
def desactivar_usuario(usuario_id: int, db: Session = Depends(get_db)):
    usuario = db.query(UsuarioRegistrado).filter(
        UsuarioRegistrado.id == usuario_id
    ).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    usuario.estado_activo = 0
    db.commit()
    return {"mensaje": "Usuario desactivado correctamente"}


# ──────────── Vehículos ────────────
@router.post("/{usuario_id}/vehiculos", response_model=VehiculoOut, status_code=201)
def agregar_vehiculo(
    usuario_id: int, datos: VehiculoCreate, db: Session = Depends(get_db)
):
    usuario = db.query(UsuarioRegistrado).filter(
        UsuarioRegistrado.id == usuario_id
    ).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if db.query(Vehiculo).filter(Vehiculo.placa == datos.placa).first():
        raise HTTPException(status_code=400, detail="Placa ya registrada")

    vehiculo = Vehiculo(
        persona_id=usuario.persona_id,
        placa=datos.placa,
        marca=datos.marca,
        modelo=datos.modelo,
        color=datos.color,
    )
    db.add(vehiculo)
    db.commit()
    db.refresh(vehiculo)
    return vehiculo


@router.get("/{usuario_id}/vehiculos", response_model=List[VehiculoOut])
def vehiculos_usuario(usuario_id: int, db: Session = Depends(get_db)):
    usuario = db.query(UsuarioRegistrado).filter(
        UsuarioRegistrado.id == usuario_id
    ).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return db.query(Vehiculo).filter(
        Vehiculo.persona_id == usuario.persona_id
    ).all()


# ──────────── Códigos QR ────────────
@router.post("/{usuario_id}/qr", response_model=dict, status_code=201)
def generar_qr(usuario_id: int, db: Session = Depends(get_db)):
    """Genera un código QR único para el usuario."""
    usuario = db.query(UsuarioRegistrado).filter(
        UsuarioRegistrado.id == usuario_id
    ).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    # Desactivar QR anteriores
    db.query(CodigoQR).filter(
        CodigoQR.usuario_id == usuario_id,
        CodigoQR.estado == "activo"
    ).update({"estado": "expirado"})

    codigo = qr_service.generar_codigo_unico(usuario_id)
    img_b64 = qr_service.generar_imagen_qr(codigo, usuario.persona.nombre)

    qr_db = CodigoQR(usuario_id=usuario_id, codigo=codigo, estado="activo")
    db.add(qr_db)
    db.commit()

    return {
        "codigo": codigo,
        "imagen_qr": img_b64,
        "mensaje": "QR generado correctamente"
    }
