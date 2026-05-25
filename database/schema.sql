CREATE DATABASE IF NOT EXISTS parqueadero_unimonserrate
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE parqueadero_unimonserrate;

CREATE TABLE IF NOT EXISTS personas (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  nombre         VARCHAR(100) NOT NULL,
  documento      VARCHAR(20)  NOT NULL UNIQUE,
  correo         VARCHAR(100) UNIQUE,
  telefono       VARCHAR(20),
  creado_en      DATETIME DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS usuarios_registrados (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  persona_id    INT NOT NULL UNIQUE,
  rol           ENUM('estudiante','docente','administrativo') NOT NULL,
  estado_activo TINYINT(1) DEFAULT 1,
  FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS visitantes (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  persona_id         INT NOT NULL,
  placa_temporal     VARCHAR(10) NOT NULL,
  fecha_autorizacion DATE NOT NULL,
  FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS vehiculos (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  persona_id INT NOT NULL,
  placa      VARCHAR(10) NOT NULL UNIQUE,
  marca      VARCHAR(50),
  modelo     VARCHAR(50),
  color      VARCHAR(30),
  FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS mensualidades (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id        INT NOT NULL,
  periodo           VARCHAR(7) NOT NULL,
  estado_pago       ENUM('activo','vencido','pendiente') NOT NULL DEFAULT 'pendiente',
  fecha_vencimiento DATE NOT NULL,
  UNIQUE KEY uk_usuario_periodo (usuario_id, periodo),
  FOREIGN KEY (usuario_id) REFERENCES usuarios_registrados(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS codigos_qr (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id       INT NOT NULL,
  codigo           VARCHAR(100) NOT NULL UNIQUE,
  fecha_generacion DATETIME DEFAULT CURRENT_TIMESTAMP,
  estado           ENUM('activo','usado','expirado') DEFAULT 'activo',
  FOREIGN KEY (usuario_id) REFERENCES usuarios_registrados(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ingresos (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  vehiculo_id        INT NOT NULL,
  fecha_hora_entrada DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_hora_salida  DATETIME,
  estado             ENUM('activo','completado','cancelado') DEFAULT 'activo',
  minutos_estadia    INT,
  valor_cobrado      DECIMAL(10,2),
  tipo_usuario       ENUM('registrado','visitante') NOT NULL,
  FOREIGN KEY (vehiculo_id) REFERENCES vehiculos(id)
);

CREATE TABLE IF NOT EXISTS pagos (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  ingreso_id INT NOT NULL UNIQUE,
  fecha_pago DATETIME DEFAULT CURRENT_TIMESTAMP,
  monto      DECIMAL(10,2) NOT NULL,
  metodo     ENUM('efectivo','tarjeta','app') DEFAULT 'efectivo',
  estado     ENUM('pendiente','completado','fallido') DEFAULT 'pendiente',
  FOREIGN KEY (ingreso_id) REFERENCES ingresos(id)
);

CREATE TABLE IF NOT EXISTS alertas (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  ingreso_id  INT NOT NULL,
  tipo        ENUM('tiempo_limite','parqueadero_lleno','pago_vencido') NOT NULL,
  mensaje     TEXT,
  fecha_envio DATETIME DEFAULT CURRENT_TIMESTAMP,
  estado      ENUM('pendiente','enviada','leida') DEFAULT 'pendiente',
  FOREIGN KEY (ingreso_id) REFERENCES ingresos(id)
);

CREATE TABLE IF NOT EXISTS auditorias (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  accion         VARCHAR(100) NOT NULL,
  tabla_afectada VARCHAR(50),
  registro_id    INT,
  usuario_doc    VARCHAR(20),
  fecha_hora     DATETIME DEFAULT CURRENT_TIMESTAMP,
  detalle        TEXT
);

CREATE TABLE IF NOT EXISTS configuracion_parqueadero (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  capacidad_total  INT          NOT NULL DEFAULT 100,
  tarifa_minuto    DECIMAL(6,2) NOT NULL DEFAULT 100.00,
  tarifa_hora      DECIMAL(8,2) NOT NULL DEFAULT 3000.00,
  horario_apertura TIME DEFAULT '06:00:00',
  horario_cierre   TIME DEFAULT '22:00:00'
);

INSERT IGNORE INTO configuracion_parqueadero (capacidad_total, tarifa_minuto, tarifa_hora)
VALUES (100, 100.00, 3000.00);

CREATE TABLE IF NOT EXISTS cuentas_usuario (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  correo        VARCHAR(150) NOT NULL UNIQUE,
  nombre        VARCHAR(100) NOT NULL,
  documento     VARCHAR(20)  UNIQUE,
  telefono      VARCHAR(20),
  password_hash VARCHAR(255) NOT NULL,
  rol           ENUM('admin','usuario') NOT NULL DEFAULT 'usuario',
  activo        TINYINT(1) DEFAULT 1,
  creado_en     DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_cuentas_correo    (correo),
  INDEX idx_cuentas_documento (documento)
);

CREATE TABLE IF NOT EXISTS vehiculos_cuenta (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  cuenta_id     INT NOT NULL,
  placa         VARCHAR(10) NOT NULL UNIQUE,
  marca         VARCHAR(50),
  modelo        VARCHAR(50),
  color         VARCHAR(30),
  tipo_vehiculo ENUM('carro','moto') NOT NULL DEFAULT 'carro',
  creado_en     DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_vehiculos_cuenta_placa (placa),
  FOREIGN KEY (cuenta_id) REFERENCES cuentas_usuario(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS qr_parqueo (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  cuenta_id   INT NOT NULL,
  vehiculo_id INT,
  codigo      VARCHAR(200) NOT NULL UNIQUE,
  tipo        ENUM('visita','mensualidad') NOT NULL DEFAULT 'visita',
  activo      TINYINT(1) DEFAULT 1,
  imagen_b64  LONGTEXT,
  creado_en   DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_qr_codigo (codigo),
  FOREIGN KEY (cuenta_id)   REFERENCES cuentas_usuario(id),
  FOREIGN KEY (vehiculo_id) REFERENCES vehiculos_cuenta(id)
);

CREATE TABLE IF NOT EXISTS facturas_v2 (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  numero        VARCHAR(30)   NOT NULL UNIQUE,
  cuenta_id     INT NOT NULL,
  tipo          ENUM('visita','mensualidad') NOT NULL,
  monto         DECIMAL(12,2) NOT NULL,
  descripcion   TEXT,
  metodo_pago   VARCHAR(50) DEFAULT 'efectivo',
  estado        ENUM('pendiente','pagada','anulada') DEFAULT 'pagada',
  fecha_emision DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_facturas_numero (numero),
  FOREIGN KEY (cuenta_id) REFERENCES cuentas_usuario(id)
);

CREATE TABLE IF NOT EXISTS sesiones_parqueo (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  cuenta_id        INT,
  qr_id            INT,
  placa            VARCHAR(10)   NOT NULL,
  tipo             ENUM('visita','mensualidad','camara') NOT NULL DEFAULT 'visita',
  tipo_vehiculo    ENUM('carro','moto') NOT NULL DEFAULT 'carro',
  entrada_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  salida_at        DATETIME,
  duracion_minutos INT,
  valor_cobrado    DECIMAL(12,2),
  estado           ENUM('activa','completada','cancelada') DEFAULT 'activa',
  factura_id       INT,
  INDEX idx_sesiones_placa (placa),
  FOREIGN KEY (cuenta_id)  REFERENCES cuentas_usuario(id),
  FOREIGN KEY (qr_id)      REFERENCES qr_parqueo(id),
  FOREIGN KEY (factura_id) REFERENCES facturas_v2(id)
);

CREATE TABLE IF NOT EXISTS mensualidades_v2 (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  cuenta_id    INT NOT NULL,
  qr_id        INT,
  periodo      VARCHAR(7)    NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_fin    DATE NOT NULL,
  monto        DECIMAL(12,2) NOT NULL DEFAULT 80000.00,
  estado       ENUM('activa','vencida','pendiente','cancelada') DEFAULT 'pendiente',
  factura_id   INT,
  creado_en    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cuenta_id)  REFERENCES cuentas_usuario(id),
  FOREIGN KEY (qr_id)      REFERENCES qr_parqueo(id),
  FOREIGN KEY (factura_id) REFERENCES facturas_v2(id)
);

CREATE OR REPLACE VIEW vista_ingresos_activos AS
SELECT
  i.id                 AS ingreso_id,
  v.placa,
  p.nombre             AS propietario,
  ur.rol,
  i.fecha_hora_entrada,
  TIMESTAMPDIFF(MINUTE, i.fecha_hora_entrada, NOW()) AS minutos_actuales
FROM ingresos i
JOIN vehiculos v ON i.vehiculo_id = v.id
JOIN personas  p ON v.persona_id  = p.id
LEFT JOIN usuarios_registrados ur ON p.id = ur.persona_id
WHERE i.estado = 'activo';

CREATE OR REPLACE VIEW vista_ocupacion AS
SELECT
  (SELECT capacidad_total FROM configuracion_parqueadero LIMIT 1) AS capacidad_total,
  COUNT(*) AS ocupados,
  (SELECT capacidad_total FROM configuracion_parqueadero LIMIT 1) - COUNT(*) AS disponibles
FROM ingresos
WHERE estado = 'activo';

CREATE INDEX IF NOT EXISTS idx_ingresos_estado   ON ingresos(estado);
CREATE INDEX IF NOT EXISTS idx_ingresos_vehiculo ON ingresos(vehiculo_id);
CREATE INDEX IF NOT EXISTS idx_vehiculos_placa   ON vehiculos(placa);
CREATE INDEX IF NOT EXISTS idx_personas_doc      ON personas(documento);
