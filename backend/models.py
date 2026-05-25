from datetime import datetime
from tz import now_col
from sqlalchemy import (
    Column, Integer, String, DateTime, Date, Time,
    DECIMAL, Enum, ForeignKey, Text, SmallInteger, Boolean
)
from sqlalchemy.orm import relationship
from database import Base

class Persona(Base):
    __tablename__ = "personas"
    id             = Column(Integer, primary_key=True, index=True)
    nombre         = Column(String(100), nullable=False)
    documento      = Column(String(20), unique=True, nullable=False)
    correo         = Column(String(100), unique=True)
    telefono       = Column(String(20))
    creado_en      = Column(DateTime, default=now_col)
    actualizado_en = Column(DateTime, default=now_col, onupdate=now_col)

    usuario    = relationship("UsuarioRegistrado", back_populates="persona", uselist=False)
    vehiculos  = relationship("Vehiculo", back_populates="persona")
    visitantes = relationship("Visitante", back_populates="persona")


class UsuarioRegistrado(Base):
    __tablename__ = "usuarios_registrados"
    id            = Column(Integer, primary_key=True, index=True)
    persona_id    = Column(Integer, ForeignKey("personas.id"), unique=True, nullable=False)
    rol           = Column(Enum("estudiante", "docente", "administrativo"), nullable=False)
    estado_activo = Column(SmallInteger, default=1)

    persona       = relationship("Persona", back_populates="usuario")
    mensualidades = relationship("Mensualidad", back_populates="usuario")
    codigos_qr    = relationship("CodigoQR", back_populates="usuario")


class Visitante(Base):
    __tablename__ = "visitantes"
    id                 = Column(Integer, primary_key=True, index=True)
    persona_id         = Column(Integer, ForeignKey("personas.id"), nullable=False)
    placa_temporal     = Column(String(10), nullable=False)
    fecha_autorizacion = Column(Date, nullable=False)
    persona = relationship("Persona", back_populates="visitantes")


class Vehiculo(Base):
    __tablename__ = "vehiculos"
    id         = Column(Integer, primary_key=True, index=True)
    persona_id = Column(Integer, ForeignKey("personas.id"), nullable=False)
    placa      = Column(String(10), unique=True, nullable=False)
    marca      = Column(String(50))
    modelo     = Column(String(50))
    color      = Column(String(30))
    persona  = relationship("Persona", back_populates="vehiculos")
    ingresos = relationship("Ingreso", back_populates="vehiculo")


class Mensualidad(Base):
    __tablename__ = "mensualidades"
    id                = Column(Integer, primary_key=True, index=True)
    usuario_id        = Column(Integer, ForeignKey("usuarios_registrados.id"), nullable=False)
    periodo           = Column(String(7), nullable=False)
    estado_pago       = Column(Enum("activo", "vencido", "pendiente"), default="pendiente")
    fecha_vencimiento = Column(Date, nullable=False)
    usuario = relationship("UsuarioRegistrado", back_populates="mensualidades")


class CodigoQR(Base):
    __tablename__ = "codigos_qr"
    id               = Column(Integer, primary_key=True, index=True)
    usuario_id       = Column(Integer, ForeignKey("usuarios_registrados.id"), nullable=False)
    codigo           = Column(String(100), unique=True, nullable=False)
    fecha_generacion = Column(DateTime, default=now_col)
    estado           = Column(Enum("activo", "usado", "expirado"), default="activo")
    usuario = relationship("UsuarioRegistrado", back_populates="codigos_qr")


class Ingreso(Base):
    __tablename__ = "ingresos"
    id                 = Column(Integer, primary_key=True, index=True)
    vehiculo_id        = Column(Integer, ForeignKey("vehiculos.id"), nullable=False)
    fecha_hora_entrada = Column(DateTime, default=now_col)
    fecha_hora_salida  = Column(DateTime)
    estado             = Column(Enum("activo", "completado", "cancelado"), default="activo")
    minutos_estadia    = Column(Integer)
    valor_cobrado      = Column(DECIMAL(10, 2))
    tipo_usuario       = Column(Enum("registrado", "visitante"), nullable=False)
    vehiculo = relationship("Vehiculo", back_populates="ingresos")
    pago     = relationship("Pago", back_populates="ingreso", uselist=False)
    alertas  = relationship("Alerta", back_populates="ingreso")


class Pago(Base):
    __tablename__ = "pagos"
    id         = Column(Integer, primary_key=True, index=True)
    ingreso_id = Column(Integer, ForeignKey("ingresos.id"), unique=True, nullable=False)
    fecha_pago = Column(DateTime, default=now_col)
    monto      = Column(DECIMAL(10, 2), nullable=False)
    metodo     = Column(Enum("efectivo", "tarjeta", "app"), default="efectivo")
    estado     = Column(Enum("pendiente", "completado", "fallido"), default="pendiente")
    ingreso = relationship("Ingreso", back_populates="pago")


class Alerta(Base):
    __tablename__ = "alertas"
    id          = Column(Integer, primary_key=True, index=True)
    ingreso_id  = Column(Integer, ForeignKey("ingresos.id"), nullable=False)
    tipo        = Column(Enum("tiempo_limite", "parqueadero_lleno", "pago_vencido"), nullable=False)
    mensaje     = Column(Text)
    fecha_envio = Column(DateTime, default=now_col)
    estado      = Column(Enum("pendiente", "enviada", "leida"), default="pendiente")
    ingreso = relationship("Ingreso", back_populates="alertas")


class Auditoria(Base):
    __tablename__ = "auditorias"
    id             = Column(Integer, primary_key=True, index=True)
    accion         = Column(String(100), nullable=False)
    tabla_afectada = Column(String(50))
    registro_id    = Column(Integer)
    usuario_doc    = Column(String(20))
    fecha_hora     = Column(DateTime, default=now_col)
    detalle        = Column(Text)


class ConfiguracionParqueadero(Base):
    __tablename__ = "configuracion_parqueadero"
    id               = Column(Integer, primary_key=True, index=True)
    capacidad_total  = Column(Integer, default=100)
    tarifa_minuto    = Column(DECIMAL(6, 2), default=100.00)
    tarifa_hora      = Column(DECIMAL(8, 2), default=3000.00)
    horario_apertura = Column(Time)
    horario_cierre   = Column(Time)

class CuentaUsuario(Base):
    __tablename__ = "cuentas_usuario"

    id            = Column(Integer, primary_key=True, index=True)
    correo        = Column(String(150), unique=True, nullable=False, index=True)
    nombre        = Column(String(100), nullable=False)
    documento     = Column(String(20), unique=True, nullable=True, index=True)
    telefono      = Column(String(20), nullable=True)
    password_hash = Column(String(255), nullable=False)
    rol           = Column(Enum("admin", "usuario"), default="usuario", nullable=False)
    activo        = Column(SmallInteger, default=1)
    creado_en     = Column(DateTime, default=now_col)

    vehiculos     = relationship("VehiculoCuenta", back_populates="cuenta",
                                 cascade="all, delete-orphan")
    mensualidades = relationship("MensualidadV2", back_populates="cuenta")
    facturas      = relationship("FacturaV2", back_populates="cuenta")
    sesiones      = relationship("SesionParqueo", back_populates="cuenta")


class VehiculoCuenta(Base):
    __tablename__ = "vehiculos_cuenta"

    id             = Column(Integer, primary_key=True, index=True)
    cuenta_id      = Column(Integer, ForeignKey("cuentas_usuario.id"), nullable=False)
    placa          = Column(String(10), unique=True, nullable=False, index=True)
    marca          = Column(String(50))
    modelo         = Column(String(50))
    color          = Column(String(30))
    tipo_vehiculo  = Column(Enum("carro", "moto"), default="carro", nullable=False)
    creado_en      = Column(DateTime, default=now_col)

    cuenta    = relationship("CuentaUsuario", back_populates="vehiculos")
    qr_visita = relationship(
        "QRParqueo",
        primaryjoin="and_(QRParqueo.vehiculo_id==VehiculoCuenta.id, QRParqueo.tipo=='visita')",
        uselist=False,
        overlaps="qr_mensualidad,vehiculo"
    )


class QRParqueo(Base):
    __tablename__ = "qr_parqueo"

    id          = Column(Integer, primary_key=True, index=True)
    cuenta_id   = Column(Integer, ForeignKey("cuentas_usuario.id"), nullable=False)
    vehiculo_id = Column(Integer, ForeignKey("vehiculos_cuenta.id"), nullable=True)
    codigo      = Column(String(200), unique=True, nullable=False, index=True)
    tipo        = Column(Enum("visita", "mensualidad"), nullable=False, default="visita")
    activo      = Column(SmallInteger, default=1)
    imagen_b64  = Column(Text, nullable=True)
    creado_en   = Column(DateTime, default=now_col)

    cuenta   = relationship("CuentaUsuario")
    vehiculo = relationship("VehiculoCuenta", overlaps="qr_visita,qr_mensualidad")
    sesiones = relationship("SesionParqueo", back_populates="qr")


class SesionParqueo(Base):
    __tablename__ = "sesiones_parqueo"

    id               = Column(Integer, primary_key=True, index=True)
    cuenta_id        = Column(Integer, ForeignKey("cuentas_usuario.id"), nullable=True)
    qr_id            = Column(Integer, ForeignKey("qr_parqueo.id"), nullable=True)
    placa            = Column(String(10), nullable=False, index=True)
    tipo             = Column(Enum("visita", "mensualidad", "camara"), nullable=False, default="visita")
    tipo_vehiculo    = Column(Enum("carro", "moto"), default="carro", nullable=False)
    entrada_at       = Column(DateTime, default=now_col, nullable=False)
    salida_at        = Column(DateTime, nullable=True)
    duracion_minutos = Column(Integer, nullable=True)
    valor_cobrado    = Column(DECIMAL(12, 2), nullable=True)
    estado           = Column(Enum("activa", "completada", "cancelada"), default="activa")
    factura_id       = Column(Integer, ForeignKey("facturas_v2.id"), nullable=True)

    cuenta  = relationship("CuentaUsuario", back_populates="sesiones")
    qr      = relationship("QRParqueo", back_populates="sesiones")
    factura = relationship("FacturaV2", back_populates="sesiones",
                           foreign_keys=[factura_id])


class MensualidadV2(Base):
    __tablename__ = "mensualidades_v2"

    id           = Column(Integer, primary_key=True, index=True)
    cuenta_id    = Column(Integer, ForeignKey("cuentas_usuario.id"), nullable=False)
    qr_id        = Column(Integer, ForeignKey("qr_parqueo.id"), nullable=True)
    periodo      = Column(String(7), nullable=False)   # "2026-05"
    fecha_inicio = Column(Date, nullable=False)
    fecha_fin    = Column(Date, nullable=False)
    monto        = Column(DECIMAL(12, 2), nullable=False, default=80000.00)
    estado       = Column(Enum("activa", "vencida", "pendiente", "cancelada"),
                          default="pendiente")
    factura_id   = Column(Integer, ForeignKey("facturas_v2.id"), nullable=True)
    creado_en    = Column(DateTime, default=now_col)

    cuenta   = relationship("CuentaUsuario", back_populates="mensualidades")
    qr       = relationship("QRParqueo")
    factura  = relationship("FacturaV2", back_populates="mensualidades",
                            foreign_keys=[factura_id])


class FacturaV2(Base):
    __tablename__ = "facturas_v2"

    id            = Column(Integer, primary_key=True, index=True)
    numero        = Column(String(30), unique=True, nullable=False, index=True)
    cuenta_id     = Column(Integer, ForeignKey("cuentas_usuario.id"), nullable=False)
    tipo          = Column(Enum("visita", "mensualidad"), nullable=False)
    monto         = Column(DECIMAL(12, 2), nullable=False)
    descripcion   = Column(Text)
    metodo_pago   = Column(String(50), default="efectivo")
    estado        = Column(Enum("pendiente", "pagada", "anulada"), default="pagada")
    fecha_emision = Column(DateTime, default=now_col)

    cuenta        = relationship("CuentaUsuario", back_populates="facturas")
    sesiones      = relationship("SesionParqueo", back_populates="factura",
                                 foreign_keys="SesionParqueo.factura_id")
    mensualidades = relationship("MensualidadV2", back_populates="factura",
                                 foreign_keys="MensualidadV2.factura_id")