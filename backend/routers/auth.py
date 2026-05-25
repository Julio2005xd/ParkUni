from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import Optional
from database import get_db
from models import CuentaUsuario
from auth import hash_password, verificar_password, crear_token, obtener_cuenta_actual

router = APIRouter(prefix="/auth", tags=["Autenticación"])

class LoginRequest(BaseModel):
    correo: str
    password: str

class RegisterRequest(BaseModel):
    nombre: str
    correo: EmailStr
    password: str
    documento: Optional[str] = None
    telefono: Optional[str] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    rol: str
    nombre: str
    cuenta_id: int

@router.post("/login", response_model=TokenResponse)
def login(datos: LoginRequest, db: Session = Depends(get_db)):
    """Login para admin y usuario. Retorna JWT Bearer token."""
    cuenta = db.query(CuentaUsuario).filter(
        CuentaUsuario.correo == datos.correo.lower().strip(),
        CuentaUsuario.activo == 1,
    ).first()

    if not cuenta or not verificar_password(datos.password, cuenta.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo o contraseña incorrectos",
        )

    token = crear_token(cuenta.id, cuenta.rol)
    return TokenResponse(
        access_token=token,
        rol=cuenta.rol,
        nombre=cuenta.nombre,
        cuenta_id=cuenta.id,
    )

@router.post("/registrar", status_code=201)
def registrar_usuario(datos: RegisterRequest, db: Session = Depends(get_db)):
    """
    Auto-registro de usuarios (rol forzado a 'usuario').
    Los admins solo se crean desde el panel de administración.
    """
    correo = datos.correo.lower().strip()

    if db.query(CuentaUsuario).filter(CuentaUsuario.correo == correo).first():
        raise HTTPException(status_code=400, detail="El correo ya está registrado")

    if datos.documento:
        if db.query(CuentaUsuario).filter(
            CuentaUsuario.documento == datos.documento
        ).first():
            raise HTTPException(status_code=400, detail="El documento ya está registrado")

    if len(datos.password) < 6:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 6 caracteres")

    cuenta = CuentaUsuario(
        correo=correo,
        nombre=datos.nombre.strip(),
        documento=datos.documento,
        telefono=datos.telefono,
        password_hash=hash_password(datos.password),
        rol="usuario",
        activo=1,
    )
    db.add(cuenta)
    db.commit()
    db.refresh(cuenta)

    token = crear_token(cuenta.id, cuenta.rol)
    return {
        "access_token": token,
        "token_type": "bearer",
        "rol": cuenta.rol,
        "nombre": cuenta.nombre,
        "cuenta_id": cuenta.id,
        "mensaje": "Cuenta creada exitosamente",
    }

@router.get("/me")
def mi_perfil(
    cuenta: CuentaUsuario = Depends(obtener_cuenta_actual),
    db: Session = Depends(get_db),
):
    """Retorna datos del usuario autenticado."""
    return {
        "id":        cuenta.id,
        "nombre":    cuenta.nombre,
        "correo":    cuenta.correo,
        "documento": cuenta.documento,
        "telefono":  cuenta.telefono,
        "rol":       cuenta.rol,
        "activo":    cuenta.activo,
        "creado_en": cuenta.creado_en.isoformat(),
    }