# 🚗 Sistema Inteligente de Parqueadero Universitario

**Fundación Universitaria Unimonserrate — Ingeniería en Software**

> Autores: **Keizy Lizeth Cuadrado Amado** · **Julio Cesar Hernandez**  
> Director: **Harry Alexander Velandia Bermudez**  
> Semestre: 6to · 2026

---

## 📋 Tabla de contenidos

1. [Descripción general](#-descripción-general)
2. [Características del sistema](#-características-del-sistema)
3. [Arquitectura](#-arquitectura)
4. [Estructura del proyecto](#-estructura-del-proyecto)
5. [Instalación con Docker](#-instalación-con-docker-recomendado)
6. [Instalación manual](#-instalación-manual-sin-docker)
7. [Configuración del entorno](#-configuración-del-entorno)
8. [Guía de uso](#-guía-de-uso)
9. [Referencia de la API](#-referencia-de-la-api)
10. [Modelo de datos](#-modelo-de-datos)
11. [Servicios internos](#-servicios-internos)
12. [Tecnologías](#-tecnologías)

---

## 📖 Descripción general

Sistema web completo para la gestión automatizada de un parqueadero universitario.
Permite el control de acceso vehicular mediante **códigos QR** y **reconocimiento de placas por OCR**,
gestión de mensualidades, facturación electrónica en PDF y envío de comprobantes por correo.

El sistema distingue dos tipos de usuarios:

| Rol | Descripción |
|-----|-------------|
| **Administrador** | Gestiona cuentas, mensualidades, monitorea sesiones activas y consulta reportes |
| **Usuario** | Registra su vehículo, genera su QR, consulta historial y descarga facturas |

---

## ✨ Características del sistema

- 🔐 **Autenticación JWT** — Tokens con expiración de 48 horas, roles diferenciados (admin/usuario)
- 📱 **QR de acceso** — Doble escaneo: 1er scan = entrada, 2do scan = salida + factura automática
- 📷 **OCR de placas** — Reconocimiento con OpenCV + Tesseract para vehículos sin QR registrado
- 🏍️ **Tipos de vehículo** — Tarifas diferenciadas: carro ($100/min · tope $30.000/día) y moto ($50/min · tope $15.000/día)
- 🗓️ **Mensualidades** — El admin asigna periodos de acceso; los mensualistas no pagan por visita, el sistema registra entradas y salidas sin cobro
- 🧾 **Facturación PDF** — Facturas electrónicas simuladas en formato colombiano (DIAN-inspired) con CUFE
- 📧 **Email automático** — Envío de facturas con PDF adjunto al correo del usuario via SMTP Gmail
- 📊 **Reportes** — Ingresos diarios/semanales/mensuales, sesiones activas en tiempo real
- 🕐 **Zona horaria Colombia** — Todas las fechas y horas en `America/Bogota` (UTC-5)

---

## 🏗️ Arquitectura

```
┌───────────────────┐        HTTP / REST        ┌─────────────────────────┐
│  React Frontend   │ ◄─────────────────────── ► │   FastAPI Backend        │
│  (Vite + JSX)     │                            │   (Python 3.11)          │
│  Puerto 3000      │                            │   Puerto 8000            │
└───────────────────┘                            └──────────┬──────────────┘
                                                            │ SQLAlchemy ORM
                                                 ┌──────────▼──────────────┐
                                                 │      MySQL 8.0           │
                                                 │      Puerto 3306         │
                                                 └─────────────────────────┘
```

### Módulos de IA / procesamiento de imágenes

| Módulo | Función |
|--------|---------|
| **OpenCV 4.9** | Preprocesamiento de imagen, binarización Otsu, umbralización adaptativa, escalado |
| **Tesseract OCR** | Reconocimiento de caracteres en placas vehiculares |
| **cv2.QRCodeDetector** | Decodificación de QR desde imagen subida al endpoint `/qr/decodificar` |

---

## 🗂️ Estructura del proyecto

```
parking-system/
│
├── docker-compose.yml          ← Orquestación de los 3 servicios (DB + API + Web)
├── .gitignore
├── README.md
│
├── database/
│   └── schema.sql              ← DDL completo: tablas legacy + tablas v2
│
├── backend/                    ← FastAPI (Python 3.11)
│   ├── main.py                 ← App principal, CORS, registro de routers, seed admin
│   ├── database.py             ← Conexión SQLAlchemy (engine + SessionLocal)
│   ├── models.py               ← Modelos ORM: tablas legacy y v2
│   ├── schemas.py              ← Schemas Pydantic (validación legacy)
│   ├── auth.py                 ← JWT: crear token, verificar, dependencias FastAPI
│   ├── tz.py                   ← Zona horaria: now_col() → datetime Colombia
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── .env.example            ← Plantilla de variables de entorno
│   │
│   ├── routers/
│   │   ├── auth.py             ← POST /auth/login, POST /auth/registro
│   │   ├── cuenta.py           ← Perfil, vehículo, QR, historial del usuario
│   │   ├── sesiones.py         ← Validación QR (entrada/salida), cámara OCR
│   │   ├── admin.py            ← Gestión de usuarios, mensualidades, reportes (admin)
│   │   ├── usuarios.py         ← CRUD legacy (compatibilidad)
│   │   ├── ingresos.py         ← Endpoints legacy de ingresos
│   │   └── mensualidades.py    ← Endpoints legacy de mensualidades
│   │
│   └── services/
│       ├── qr_service.py       ← Genera código único y imagen QR en base64
│       ├── ocr_service.py      ← Pipeline OpenCV + Tesseract para placas
│       ├── invoice_service.py  ← Generación de PDF (factura visita + mensualidad)
│       ├── email_service.py    ← Envío SMTP con adjunto PDF
│       └── cobro_service.py    ← Lógica de tarifas (legacy)
│
└── frontend/                   ← React 18 + Vite
    ├── Dockerfile
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── main.jsx            ← Punto de entrada React
        ├── App.jsx             ← Router principal + rutas protegidas
        ├── App.css             ← Estilos globales (dark theme Navy)
        ├── theme.js            ← Variables de color y tipografía
        ├── context/
        │   └── AuthContext.jsx ← Context API: token JWT, usuario, login/logout
        ├── services/
        │   └── api.js          ← Cliente Axios con interceptor de Authorization
        └── pages/
            ├── Landing.jsx             ← Página de inicio con info del sistema
            ├── CamaraPlacas.jsx        ← Interfaz OCR de cámara (acceso público)
            ├── user/
            │   ├── UserLogin.jsx       ← Login de usuario
            │   ├── UserRegister.jsx    ← Registro de usuario
            │   └── UserDashboard.jsx   ← Panel usuario: perfil, vehículo, QR, historial
            └── admin/
                ├── AdminLogin.jsx          ← Login administrador
                ├── AdminDashboard.jsx      ← Panel admin: sesiones activas, cuentas
                ├── AdminMensualidades.jsx  ← Gestión de mensualidades + QR
                └── AdminReportes.jsx       ← Reportes de ingresos y estadísticas
```

---

## 🚀 Instalación con Docker (recomendado)

### Requisitos previos

| Herramienta | Versión mínima | Verificar |
|-------------|---------------|-----------|
| Docker Desktop | 24+ | `docker --version` |
| Docker Compose | 2.x (incluido en Docker Desktop) | `docker compose version` |
| Git | cualquiera | `git --version` |

### Pasos

```bash
# 1. Clonar el repositorio
git clone https://github.com/tu-usuario/parking-system.git
cd parking-system

# 2. Configurar variables de entorno
cp backend/.env.example backend/.env
# Editar backend/.env con tu cuenta Gmail y la contraseña de aplicación
# (si no se configura SMTP, el sistema funciona igual pero no envía emails)

# 3. Construir y levantar los servicios
docker compose up --build

# La primera vez descarga las imágenes base (~500 MB) y compila todo.
# Esperar hasta ver en consola:
#   Application startup complete.

# 4. Acceder al sistema
#   Frontend:      http://localhost:3000
#   API (swagger):  http://localhost:8000/docs
#   API (redoc):    http://localhost:8000/redoc
```

### Credenciales por defecto

| Rol | Correo | Contraseña |
|-----|--------|-----------|
| Administrador | `admin@parqueadero.edu.co` | `admin123` |
| Usuario demo | (registrar desde la web) | — |

### Comandos útiles de Docker

```bash
# Ver logs en tiempo real
docker compose logs -f

# Ver solo logs del backend
docker compose logs -f backend

# Detener sin borrar datos
docker compose stop

# Detener y eliminar contenedores (conserva la BD en volumen)
docker compose down

# Eliminar todo incluyendo datos de la BD
docker compose down -v

# Reiniciar solo el backend (tras cambio de código)
docker compose restart backend
```

> **Nota sobre hot-reload:** Los directorios `backend/` y `frontend/src/` están montados como volúmenes en Docker. Los cambios en el código se aplican automáticamente sin reconstruir las imágenes:
> - Backend: Uvicorn con `--reload` detecta cambios en `.py`
> - Frontend: Vite con HMR detecta cambios en `.jsx/.css`

---

## 🛠️ Instalación manual (sin Docker)

### Requisitos del sistema

| Componente | Versión | Notas |
|-----------|---------|-------|
| Python | 3.11+ | `python --version` |
| pip | 23+ | `pip --version` |
| Node.js | 20+ | `node --version` |
| npm | 10+ | `npm --version` |
| MySQL | 8.0+ | Servidor corriendo en puerto 3306 |
| Tesseract OCR | 5.x | Ver instrucciones de instalación abajo |

### 1. Instalar Tesseract OCR

**Windows:**
```powershell
# Descargar instalador desde:
# https://github.com/UB-Mannheim/tesseract/wiki
# Instalar y agregar al PATH: C:\Program Files\Tesseract-OCR
```

**Ubuntu/Debian:**
```bash
sudo apt-get install tesseract-ocr tesseract-ocr-spa
```

**macOS:**
```bash
brew install tesseract tesseract-lang
```

### 2. Configurar la base de datos

```sql
-- En MySQL:
CREATE DATABASE parqueadero_unimonserrate CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'parkuser'@'localhost' IDENTIFIED BY 'parkpass123';
GRANT ALL PRIVILEGES ON parqueadero_unimonserrate.* TO 'parkuser'@'localhost';
FLUSH PRIVILEGES;
```

```bash
# Cargar el esquema completo
mysql -u parkuser -p parqueadero_unimonserrate < database/schema.sql
```

### 3. Configurar el backend

```bash
cd backend

# Crear entorno virtual (recomendado)
python -m venv venv
source venv/bin/activate        # Linux/Mac
venv\Scripts\activate           # Windows PowerShell

# Instalar dependencias
pip install -r requirements.txt

# Configurar variables de entorno
cp .env.example .env
# Editar .env con los datos de tu BD y SMTP

# Iniciar el servidor (con auto-reload)
uvicorn main:app --reload --port 8000
```

Las tablas v2 se crean automáticamente al iniciar si no existen.

### 4. Configurar el frontend

```bash
cd frontend

# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev
# → http://localhost:5173 (Vite usa 5173 por defecto en modo manual)
```

> En modo manual el frontend corre en el puerto **5173** y el backend en **8000**.
> El proxy de Vite redirige `/api` hacia `http://localhost:8000` automáticamente.

---

## ⚙️ Configuración del entorno

El archivo `backend/.env` (copia de `.env.example`) controla el comportamiento del sistema:

```ini
# Base de datos
DB_HOST=localhost          # En Docker: nombre del servicio (db)
DB_USER=parkuser
DB_PASSWORD=parkpass123
DB_NAME=parqueadero_unimonserrate

# JWT
JWT_SECRET=clave-secreta-larga-y-aleatoria
ACCESS_TOKEN_EXPIRE_MINUTES=2880   # 48 horas

# Admin inicial (se crea automáticamente al primer inicio)
ADMIN_EMAIL=admin@parqueadero.edu.co
ADMIN_PASSWORD=admin123

# SMTP Gmail (opcional — sin esto los emails se muestran en consola)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu-cuenta@gmail.com
SMTP_PASSWORD=xxxx xxxx xxxx xxxx   # Contraseña de aplicación Google (16 chars)
MAIL_FROM=tu-cuenta@gmail.com
MAIL_FROM_NAME=Parqueadero Unimonserrate
```

### Configurar Gmail para envío de emails

1. Ve a [myaccount.google.com](https://myaccount.google.com) → **Seguridad**
2. Activa **Verificación en 2 pasos**
3. En el mismo menú → **Contraseñas de aplicaciones**
4. Genera una contraseña para "Otra aplicación" → dale nombre "Parqueadero"
5. Copia los 16 caracteres al campo `SMTP_PASSWORD` del `.env`

Si `SMTP_HOST` está vacío, el sistema no envía emails pero sí genera las facturas PDF descargables desde el panel.

---

## 📖 Guía de uso

### Para el Usuario registrado

1. **Registro** → Ir a `http://localhost:3000` → "Registrarse como usuario"
2. **Ingresar datos** → nombre, correo, contraseña (mínimo 6 caracteres)
3. **Registrar vehículo** → Desde el panel: ingresar placa (formato `ABC123` o `ABC12D`), marca, modelo, color y **tipo de vehículo** (Carro o Motocicleta)
4. **Generar QR** → Pulsar "Generar QR de acceso" — se muestra el código QR
5. **Descargar QR** → Botón "Descargar QR" guarda la imagen directamente en el dispositivo
6. **Usar el parqueadero**:
   - Mostrar el QR al guardia/escáner al **entrar** → sistema registra la entrada
   - Mostrar el mismo QR al **salir** → sistema calcula el tiempo, genera factura y la envía por email
7. **Historial** → Ver todas las sesiones y facturas desde el panel de usuario

### Para el Administrador

1. **Ingresar** → `http://localhost:3000` → "Administrador" → usar credenciales admin
2. **Panel principal** (`/admin`):
   - Ver sesiones activas en tiempo real con cobro acumulado
   - Gestionar cuentas de usuario (activar/desactivar)
   - Consultar historial completo de sesiones
3. **Mensualidades** (`/admin/mensualidades`):
   - Crear mensualidad para un usuario → seleccionar cuenta, periodo, fecha inicio/fin, monto
   - Al crear: el sistema genera automáticamente el QR de mensualidad, la factura PDF y envía el email
   - Ver conteo de entradas y salidas por periodo
   - Descargar el QR de mensualidad desde la tabla (botón en la columna QR)
4. **Reportes** (`/admin/reportes`):
   - Ver resumen de ingresos del día/semana/mes
   - Gráfica de sesiones por periodo

### Cámara OCR (`/camara`)

Interfaz pública para registrar vehículos mediante captura de placa:
- Captura imagen con la cámara del dispositivo o sube un archivo
- El backend procesa la imagen con OpenCV + Tesseract
- Si la placa está registrada, la asocia al usuario correspondiente
- Registra entrada o salida según el estado de la sesión

---

## 📡 Referencia de la API

La documentación interactiva completa está disponible en:  
- **Swagger UI:** `http://localhost:8000/docs`  
- **ReDoc:** `http://localhost:8000/redoc`

### Autenticación

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/auth/registro` | Crear cuenta de usuario |
| `POST` | `/auth/login` | Iniciar sesión → retorna JWT |

**Ejemplo login:**
```bash
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"correo": "admin@parqueadero.edu.co", "password": "admin123"}'
# → {"access_token": "eyJ...", "token_type": "bearer", "rol": "admin"}
```

### Mi cuenta (usuario autenticado)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/cuenta/perfil` | Obtener perfil propio |
| `PUT` | `/cuenta/perfil` | Actualizar nombre, teléfono, documento |
| `GET` | `/cuenta/vehiculo` | Ver vehículo registrado |
| `POST` | `/cuenta/vehiculo` | Registrar vehículo (placa + tipo) |
| `PUT` | `/cuenta/vehiculo` | Actualizar datos del vehículo |
| `GET` | `/cuenta/qr` | Obtener QR de visita activo |
| `POST` | `/cuenta/qr/generar` | Generar nuevo QR (invalida el anterior) |
| `GET` | `/cuenta/sesiones` | Historial de sesiones propias |
| `GET` | `/cuenta/facturas` | Historial de facturas propias |
| `GET` | `/cuenta/facturas/{id}/pdf` | Descargar factura en PDF |

### Sesiones (control de acceso)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/sesiones/validar-qr` | Escanear QR → registra entrada o salida + factura |
| `POST` | `/sesiones/camara-placa` | Registrar entrada/salida por placa (OCR) |
| `GET` | `/sesiones/activas` | Listar sesiones activas en tiempo real (admin) |
| `GET` | `/sesiones/historial` | Historial completo de sesiones (admin) |

**Ejemplo validar QR:**
```bash
curl -X POST http://localhost:8000/sesiones/validar-qr \
  -H "Content-Type: application/json" \
  -d '{"codigo": "PKQ-1-xK9mP..."}'
# → {"autorizado": true, "accion": "entrada", "tipo": "visita", "placa": "ABC123", ...}
```

### Administración (requiere rol admin)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/admin/cuentas` | Listar todas las cuentas de usuario |
| `PUT` | `/admin/cuentas/{id}/toggle` | Activar / desactivar cuenta |
| `GET` | `/admin/mensualidades` | Listar mensualidades con conteo de usos |
| `POST` | `/admin/mensualidades` | Crear mensualidad + QR + factura + email |
| `PUT` | `/admin/mensualidades/{id}/estado` | Cambiar estado de mensualidad |
| `GET` | `/admin/reportes/resumen` | Resumen de ingresos por periodo |

### OCR y QR (endpoints especiales)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/ocr/detectar-placa` | Detectar placa en imagen (multipart/form-data) |
| `POST` | `/qr/decodificar` | Decodificar código QR desde imagen |

---

## 🗃️ Modelo de datos

### Entidades principales (v2)

```
CuentaUsuario (cuentas_usuario)
  │   correo UNIQUE · nombre · documento · password_hash (bcrypt)
  │   rol: admin | usuario · activo
  │
  ├──< VehiculoCuenta (vehiculos_cuenta)
  │       placa UNIQUE · marca · modelo · color
  │       tipo_vehiculo: carro | moto
  │       └──< QRParqueo (qr_parqueo)
  │               codigo UNIQUE · tipo: visita | mensualidad · activo · imagen_b64
  │
  ├──< SesionParqueo (sesiones_parqueo)
  │       placa · tipo: visita | mensualidad | camara
  │       tipo_vehiculo: carro | moto
  │       entrada_at · salida_at · duracion_minutos · valor_cobrado
  │       estado: activa | completada | cancelada
  │       └── FacturaV2 (FK)
  │
  ├──< MensualidadV2 (mensualidades_v2)
  │       periodo "2026-05" · fecha_inicio · fecha_fin · monto
  │       estado: activa | vencida | pendiente | cancelada
  │       └── FacturaV2 (FK) · QRParqueo (FK)
  │
  └──< FacturaV2 (facturas_v2)
          numero "FAC-2026-00001" · tipo: visita | mensualidad
          monto · descripcion · metodo_pago · estado: pendiente | pagada | anulada
```

### Lógica de tarifas

```
tipo_vehiculo = "carro"  →  $100 COP/minuto   · tope $30.000/día
tipo_vehiculo = "moto"   →  $50  COP/minuto   · tope $15.000/día
tipo_vehiculo = mensualidad → $0 (acceso libre dentro del periodo)
```

### Flujo de doble escaneo QR

```
Usuario llega al parqueadero
         │
         ▼
  Escanea su QR (1er scan)
         │
  ┌──────▼──────────────────────────────────────────┐
  │  ¿Tipo QR?                                      │
  │                                                 │
  │  "visita"       →  Registra SesionParqueo       │
  │                    estado="activa"               │
  │                    entrada_at = now_col()         │
  │                                                 │
  │  "mensualidad"  →  Verifica MensualidadV2       │
  │                    vigente (fecha_inicio/fin)     │
  │                    Registra sesión sin cobro     │
  └─────────────────────────────────────────────────┘
         │
    (tiempo en el parqueadero)
         │
  Escanea el mismo QR (2do scan)
         │
  ┌──────▼──────────────────────────────────────────┐
  │  ¿Sesión activa?  SÍ                            │
  │                                                 │
  │  "visita"       →  Calcula cobro:               │
  │                    minutos × tarifa_vehiculo     │
  │                    min(cobro, tope_diario)       │
  │                    Genera FacturaV2 (PDF)        │
  │                    Envía email con adjunto       │
  │                    estado sesión = "completada"  │
  │                                                 │
  │  "mensualidad"  →  Registra salida              │
  │                    valor_cobrado = $0            │
  │                    Actualiza conteo de usos      │
  └─────────────────────────────────────────────────┘
```

---

## 🔧 Servicios internos

### `services/qr_service.py`
- **`generar_codigo_unico(cuenta_id)`** — Genera un código UUID único con prefijo del sistema
- **`generar_imagen_qr(codigo, nombre)`** — Crea imagen QR con logo superpuesto, retorna base64

### `services/ocr_service.py`
- **`procesar_imagen_bytes(bytes)`** — Pipeline multi-estrategia:
  1. Preprocesamiento OpenCV (escala de grises, Otsu, adaptativo, escalado 2x)
  2. Tesseract OCR con configuración `--psm 8` (palabra única)
  3. Post-procesamiento: regex para formato placa colombiana `[A-Z]{3}[0-9]{2}[0-9A-Z]`

### `services/invoice_service.py`
- **`generar_visita(...)`** — PDF factura de visita: datos emisor, cliente, vehículo, tabla de tiempo, totales, CUFE simulado
- **`generar_mensualidad(...)`** — PDF factura de mensualidad: periodo, vigencia, monto, CUFE simulado
- Usa `fpdf2` (pure-Python, sin dependencias del SO)

### `services/email_service.py`
- **`enviar_factura(...)`** — Email HTML + PDF adjunto al usuario tras salida
- **`enviar_mensualidad(...)`** — Email de confirmación al crear mensualidad
- **`enviar_alerta(...)`** — Notificaciones generales
- En modo demo (sin SMTP configurado) imprime en consola sin error

### `auth.py`
- **`hash_password(pwd)`** — bcrypt hash
- **`verificar_password(plain, hash)`** — bcrypt verify
- **`crear_token(cuenta_id, rol)`** — JWT HS256, expira en 48h
- **`obtener_cuenta_actual`** — Dependencia FastAPI: extrae y valida token del header
- **`requerir_admin`** — Dependencia: fuerza rol="admin" o lanza 403

### `tz.py`
- **`now_col()`** — Retorna `datetime.now(ZoneInfo("America/Bogota"))` para que todos los timestamps sean en hora colombiana (UTC-5)

---

## 🛠️ Tecnologías

| Capa | Tecnología | Versión | Rol |
|------|-----------|---------|-----|
| Frontend | React | 18 | UI reactiva con componentes funcionales |
| Frontend | Vite | 5 | Bundler + dev server con HMR |
| Frontend | React Router DOM | 6 | Enrutamiento SPA con rutas protegidas |
| Backend | FastAPI | 0.111 | Framework REST asíncrono |
| Backend | Python | 3.11 | Lenguaje principal del backend |
| Backend | Uvicorn | 0.29 | Servidor ASGI con reload automático |
| ORM | SQLAlchemy | 2.0 | Mapeo objeto-relacional + migraciones |
| Base de datos | MySQL | 8.0 | Motor relacional principal |
| Autenticación | python-jose + passlib | — | JWT HS256 + bcrypt |
| Validación | Pydantic | v2 | Schemas de entrada/salida |
| OCR | Tesseract | 5.x | Reconocimiento de texto en imágenes |
| Visión | OpenCV | 4.9 | Procesamiento de imágenes |
| QR | qrcode[pil] | 7.4 | Generación de códigos QR |
| PDF | fpdf2 | 2.7 | Generación de documentos PDF |
| Email | smtplib (stdlib) | — | Envío SMTP con TLS |
| Contenedores | Docker + Compose | — | Despliegue reproducible |

---

## 🔒 Seguridad implementada

- Contraseñas hasheadas con **bcrypt** (factor de costo 12)
- Tokens **JWT HS256** con expiración de 48 horas
- **Rutas protegidas** en frontend (React Router) y backend (dependencias FastAPI)
- Validación de **formato de placa** colombiana con regex `^[A-Z]{3}[0-9]{2}[0-9A-Z]$`
- Un vehículo **no puede tener dos sesiones activas** simultáneas
- El usuario solo accede a **sus propias facturas** (verificación de `cuenta_id`)
- Claves secretas en **variables de entorno** (nunca en código)

---

## 👥 Autores

| Nombre | Rol |
|--------|-----|
| Keizy Lizeth Cuadrado Amado | Desarrolladora Full Stack |
| Julio Cesar Hernandez | Desarrollador Full Stack |
| Harry Alexander Velandia Bermudez | Director / Tutor |

**Fundación Universitaria Unimonserrate**  
Ingeniería en Software — 6to semestre — 2026

---

*Proyecto académico — Facturación simulada, no tiene validez fiscal ante la DIAN.*
