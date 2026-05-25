"""
auth.py — Utilidades JWT y dependencias de autenticación
"""
import os
from datetime import datetime, timedelta
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from database import get_db
from models import CuentaUsuario

SECRET_KEY  = os.getenv("JWT_SECRET", "parqueadero-unimonserrate-secret-2026-xK9#mP")
ALGORITHM   = "HS256"
TOKEN_HOURS = 48

pwd_context   = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


# ── Hash helpers ───────────────────────────────────────────────────
def verificar_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


# ── Token helpers ──────────────────────────────────────────────────
def crear_token(cuenta_id: int, rol: str) -> str:
    expire = datetime.utcnow() + timedelta(hours=TOKEN_HOURS)
    payload = {"sub": str(cuenta_id), "rol": rol, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def _decodificar_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return {}


# ── FastAPI dependencies ───────────────────────────────────────────
def obtener_cuenta_actual(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> CuentaUsuario:
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token inválido o expirado",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise exc
    payload = _decodificar_token(token)
    cuenta_id = payload.get("sub")
    if not cuenta_id:
        raise exc
    cuenta = db.query(CuentaUsuario).filter(
        CuentaUsuario.id == int(cuenta_id),
        CuentaUsuario.activo == 1,
    ).first()
    if not cuenta:
        raise exc
    return cuenta


def requerir_admin(
    cuenta: CuentaUsuario = Depends(obtener_cuenta_actual),
) -> CuentaUsuario:
    if cuenta.rol != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requieren permisos de administrador",
        )
    return cuenta