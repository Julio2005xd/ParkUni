"""
schemas.py — Esquemas Pydantic para validación de entrada/salida
"""
from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, EmailStr, field_validator
import re


# ──────────────────────────────────────────────
# PERSONAS
# ──────────────────────────────────────────────
class PersonaBase(BaseModel):
    nombre:    str
    documento: str
    correo:    Optional[EmailStr] = None
    telefono:  Optional[str] = None


class PersonaCreate(PersonaBase):
    pass


class PersonaOut(PersonaBase):
    id:        int
    creado_en: datetime

    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# USUARIOS REGISTRADOS
# ──────────────────────────────────────────────
class UsuarioCreate(BaseModel):
    nombre:    str
    documento: str
    correo:    Optional[EmailStr] = None
    telefono:  Optional[str] = None
    rol:       str  # estudiante | docente | administrativo

    @field_validator("rol")
    @classmethod
    def rol_valido(cls, v):
        roles = {"estudiante", "docente", "administrativo"}
        if v not in roles:
            raise ValueError(f"Rol debe ser uno de: {roles}")
        return v


class UsuarioOut(BaseModel):
    id:            int
    persona:       PersonaOut
    rol:           str
    estado_activo: int

    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# VEHÍCULOS
# ──────────────────────────────────────────────
class VehiculoCreate(BaseModel):
    persona_id: int
    placa:      str
    marca:      Optional[str] = None
    modelo:     Optional[str] = None
    color:      Optional[str] = None

    @field_validator("placa")
    @classmethod
    def placa_formato(cls, v):
        v = v.upper().strip()
        # Formato colombiano: ABC-123 o ABC123
        if not re.match(r"^[A-Z]{3}[- ]?\d{3}$", v):
            raise ValueError("Formato de placa inválido. Use: ABC123 o ABC-123")
        return v.replace("-", "").replace(" ", "")


class VehiculoOut(BaseModel):
    id:    int
    placa: str
    marca: Optional[str]
    modelo: Optional[str]
    color: Optional[str]

    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# MENSUALIDADES
# ──────────────────────────────────────────────
class MensualidadCreate(BaseModel):
    usuario_id:        int
    periodo:           str   # '2026-05'
    estado_pago:       str
    fecha_vencimiento: date


class MensualidadOut(BaseModel):
    id:                int
    usuario_id:        int
    periodo:           str
    estado_pago:       str
    fecha_vencimiento: date

    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# INGRESOS
# ──────────────────────────────────────────────
class IngresoCreate(BaseModel):
    placa:       str
    tipo_usuario: str = "registrado"


class IngresoSalida(BaseModel):
    ingreso_id: int
    metodo_pago: str = "efectivo"


class IngresoOut(BaseModel):
    id:                 int
    vehiculo_id:        int
    fecha_hora_entrada: datetime
    fecha_hora_salida:  Optional[datetime]
    estado:             str
    minutos_estadia:    Optional[int]
    valor_cobrado:      Optional[float]
    tipo_usuario:       str

    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# PAGOS
# ──────────────────────────────────────────────
class PagoOut(BaseModel):
    id:         int
    ingreso_id: int
    fecha_pago: datetime
    monto:      float
    metodo:     str
    estado:     str

    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# QR
# ──────────────────────────────────────────────
class QRValidar(BaseModel):
    codigo: str


class QROut(BaseModel):
    id:               int
    usuario_id:       int
    codigo:           str
    fecha_generacion: datetime
    estado:           str

    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# OCR (reconocimiento de placa)
# ──────────────────────────────────────────────
class OCRResult(BaseModel):
    placa_detectada: str
    confianza:       float
    imagen_procesada: Optional[str] = None  # base64


# ──────────────────────────────────────────────
# DASHBOARD / REPORTES
# ──────────────────────────────────────────────
class OcupacionOut(BaseModel):
    capacidad_total: int
    ocupados:        int
    disponibles:     int
    porcentaje:      float


class ReporteIngresosOut(BaseModel):
    fecha:          str
    total_ingresos: int
    total_recaudado: float


class AlertaOut(BaseModel):
    id:         int
    ingreso_id: int
    tipo:       str
    mensaje:    str
    fecha_envio: datetime
    estado:     str

    model_config = {"from_attributes": True}
