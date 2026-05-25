Sistema Inteligente de Parqueadero Universitario

Fundacion Universitaria Unimonserrate — Ingenieria en Software

Autores: Keizy Lizeth Cuadrado Amado · Julio Cesar Hernandez
Profesor: Harry Alexander Velandia Bermudez
Semestre: 6to — 2026


Tabla de contenidos

1. [Descripcion general](#descripcion-general)
2. [Caracteristicas del sistema](#caracteristicas-del-sistema)
3. [Arquitectura](#arquitectura)
4. [Estructura del proyecto](#estructura-del-proyecto)
5. [Instalacion con Docker](#instalacion-con-docker)
6. [Instalacion manual](#instalacion-manual)
7. [Configuracion del entorno](#configuracion-del-entorno)
8. [Guia de uso](#guia-de-uso)
9. [Referencia de la API](#referencia-de-la-api)
10. [Modelo de datos](#modelo-de-datos)
11. [Servicios internos](#servicios-internos)
12. [Tecnologias](#tecnologias)


Descripcion general

Sistema web completo para la gestion automatizada de un parqueadero universitario.
Permite el control de acceso vehicular mediante codigos QR y reconocimiento de placas
por OCR, gestion de mensualidades, facturacion electronica en PDF y envio de
comprobantes por correo.

El sistema distingue dos tipos de usuarios:

| Rol | Descripcion |
|-----|-------------|
| Administrador | Gestiona cuentas, mensualidades, monitorea sesiones activas y consulta reportes |
| Usuario | Registra su vehiculo, genera su QR, consulta historial y descarga facturas |

Caracteristicas del sistema

- Autenticacion JWT: tokens con expiracion de 48 horas y roles diferenciados (admin/usuario)
- QR de acceso: doble escaneo; primer scan registra entrada, segundo scan registra salida y genera factura automatica
- OCR de placas: reconocimiento con OpenCV y Tesseract para vehiculos sin QR registrado
- Tipos de vehiculo: tarifas diferenciadas para carro ($100/min, tope $30.000/dia) y moto ($50/min, tope $15.000/dia)
- Mensualidades: el admin asigna periodos de acceso; los mensualistas no pagan por visita, el sistema registra entradas y salidas sin cobro
- Facturacion PDF: facturas electronicas simuladas en formato colombiano (DIAN-inspired) con CUFE
- Email automatico: envio de facturas con PDF adjunto al correo del usuario via SMTP Gmail
- Reportes: ingresos diarios, semanales y mensuales, sesiones activas en tiempo real
- Zona horaria Colombia: todas las fechas y horas en America/Bogota (UTC-5)

Arquitectura

React Frontend (Vite + JSX, Puerto 3000)
    |
    | HTTP / REST
    |
FastAPI Backend (Python 3.11, Puerto 8000)
    |
    | SQLAlchemy ORM
    |
MySQL 8.0 (Puerto 3306)

Modulos de procesamiento de imagenes

| Modulo | Funcion |
|--------|---------|
| OpenCV 4.9 | Preprocesamiento de imagen, binarizacion Otsu, umbralización adaptativa, escalado |
| Tesseract OCR | Reconocimiento de caracteres en placas vehiculares |
| cv2.QRCodeDetector | Decodificacion de QR desde imagen subida al endpoint /qr/decodificar |

Estructura del proyecto


parking-system/
|
+-- docker-compose.yml
+-- README.md
|
+-- database/
|   +-- schema.sql
|
+-- backend/
|   +-- main.py
|   +-- database.py
|   +-- models.py
|   +-- schemas.py
|   +-- auth.py
|   +-- tz.py
|   +-- requirements.txt
|   +-- Dockerfile
|   +-- .env.example
|   |
|   +-- routers/
|   |   +-- auth.py
|   |   +-- cuenta.py
|   |   +-- sesiones.py
|   |   +-- admin.py
|   |   +-- usuarios.py
|   |   +-- ingresos.py
|   |   +-- mensualidades.py
|   |
|   +-- services/
|       +-- qr_service.py
|       +-- ocr_service.py
|       +-- invoice_service.py
|       +-- email_service.py
|       +-- cobro_service.py
|
+-- frontend/
    +-- Dockerfile
    +-- package.json
    +-- vite.config.js
    +-- src/
        +-- main.jsx
        +-- App.jsx
        +-- App.css
        +-- theme.js
        +-- context/
        |   +-- AuthContext.jsx
        +-- services/
        |   +-- api.js
        +-- pages/
            +-- Landing.jsx
            +-- CamaraPlacas.jsx
            +-- user/
            |   +-- UserLogin.jsx
            |   +-- UserRegister.jsx
            |   +-- UserDashboard.jsx
            +-- admin/
                +-- AdminLogin.jsx
                +-- AdminDashboard.jsx
                +-- AdminMensualidades.jsx
                +-- AdminReportes.jsx


Instalacion con Docker

Requisitos previos

| Herramienta | Version minima | Verificacion |
|-------------|----------------|--------------|
| Docker Desktop | 24+ | docker --version |
| Docker Compose | 2.x | docker compose version |
| Git | cualquiera | git --version |

Pasos

bash
1. Clonar el repositorio
git clone https://github.com/tu-usuario/parking-system.git
cd parking-system

2. Configurar variables de entorno
cp backend/.env.example backend/.env
Editar backend/.env con la cuenta Gmail y contrasena de aplicacion

3. Construir y levantar los servicios
docker compose up --build

4. Acceder al sistema
  Frontend:  http://localhost:3000
  API Docs:  http://localhost:8000/docs


Credenciales por defecto

| Rol | Correo | Contrasena |
|-----|--------|-----------|
| Administrador | admin@parqueadero.edu.co | admin123 |
| Usuario | registrar desde la web | — |

Comandos utiles de Docker

bash
# Ver logs en tiempo real
docker compose logs -f

# Ver logs solo del backend
docker compose logs -f backend

# Detener sin borrar datos
docker compose stop

# Detener y eliminar contenedores (conserva la BD en volumen)
docker compose down

# Eliminar todo incluyendo datos de la BD
docker compose down -v

# Reiniciar solo el backend
docker compose restart backend


Los directorios backend/ y frontend/src/ estan montados como volumenes en Docker.
Los cambios en el codigo se aplican automaticamente sin reconstruir las imagenes.
El backend usa Uvicorn con --reload y el frontend usa Vite con HMR.



Instalacion manual

Requisitos del sistema

| Componente | Version |
|-----------|---------|
| Python | 3.11+ |
| pip | 23+ |
| Node.js | 20+ |
| npm | 10+ |
| MySQL | 8.0+ |
| Tesseract OCR | 5.x |

1. Instalar Tesseract OCR

Windows:
powershell
Descargar instalador desde:
https://github.com/UB-Mannheim/tesseract/wiki
Instalar y agregar al PATH: C:\Program Files\Tesseract-OCR

Ubuntu/Debian:
bash
sudo apt-get install tesseract-ocr tesseract-ocr-spa

macOS:
bash
brew install tesseract tesseract-lang

2. Configurar la base de datos

sql
CREATE DATABASE parqueadero_unimonserrate CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'parkuser'@'localhost' IDENTIFIED BY 'parkpass123';
GRANT ALL PRIVILEGES ON parqueadero_unimonserrate.* TO 'parkuser'@'localhost';
FLUSH PRIVILEGES;
```

bash
mysql -u parkuser -p parqueadero_unimonserrate < database/schema.sql


3. Configurar el backend

bash
cd backend

python -m venv venv
source venv/bin/activate        # Linux/Mac
venv\Scripts\activate           # Windows

pip install -r requirements.txt

cp .env.example .env
  Editar .env con los datos de BD y SMTP

uvicorn main:app --reload --port 8000


4. Configurar el frontend

bash
cd frontend
npm install
npm run dev
Disponible en http://localhost:5173

En modo manual el frontend corre en el puerto 5173 y el backend en el 8000.
El proxy de Vite redirige /api hacia http://localhost:8000 automaticamente.

Configuracion del entorno

El archivo backend/.env controla el comportamiento del sistema:

ini
Base de datos
DB_HOST=localhost
DB_USER=parkuser
DB_PASSWORD=parkpass123
DB_NAME=parqueadero_unimonserrate

JWT
JWT_SECRET=clave-secreta-larga-y-aleatoria
ACCESS_TOKEN_EXPIRE_MINUTES=2880

Admin inicial
ADMIN_EMAIL=admin@parqueadero.edu.co
ADMIN_PASSWORD=admin123

SMTP Gmail
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu-cuenta@gmail.com
SMTP_PASSWORD=xxxx xxxx xxxx xxxx
MAIL_FROM=tu-cuenta@gmail.com
MAIL_FROM_NAME=Parqueadero Unimonserrate

Configurar Gmail para envio de emails

1. Ir a myaccount.google.com -> Seguridad
2. Activar Verificacion en 2 pasos
3. En el mismo menu -> Contrasennas de aplicaciones
4. Generar una contrasenna para "Otra aplicacion" con nombre "Parqueadero"
5. Copiar los 16 caracteres al campo SMTP_PASSWORD del .env

Si SMTP_HOST esta vacio, el sistema no envia emails pero genera las facturas PDF
descargables desde el panel.

Guia de uso

Para el usuario registrado

1. Ir a http://localhost:3000 y seleccionar "Registrarse como usuario"
2. Ingresar nombre, correo y contrasenna (minimo 6 caracteres)
3. Desde el panel, registrar el vehiculo: placa (formato ABC123 o ABC12D), marca, modelo, color y tipo (Carro o Motocicleta)
4. Pulsar "Generar QR de acceso" para obtener el codigo QR personal
5. Descargar el QR con el boton correspondiente
6. Al entrar al parqueadero: mostrar el QR; el sistema registra la entrada
7. Al salir del parqueadero: mostrar el mismo QR; el sistema calcula el tiempo, genera la factura y la envia por email
8. Consultar el historial de sesiones y facturas desde el panel de usuario

Para el administrador

1. Ir a http://localhost:3000 -> "Administrador" e ingresar con las credenciales admin
2. Panel principal (/admin): ver sesiones activas con cobro acumulado, gestionar cuentas y consultar historial completo
3. Mensualidades (/admin/mensualidades): crear mensualidad para un usuario seleccionando cuenta, periodo, fecha inicio/fin y monto. El sistema genera el QR de mensualidad, la factura PDF y envia el email automaticamente
4. Reportes (/admin/reportes): resumen de ingresos por dia, semana y mes, con grafica de sesiones por periodo

Camara OCR (/camara)

Interfaz publica para registrar vehiculos mediante captura de placa. Captura imagen
con la camara del dispositivo o permite subir un archivo. El backend procesa la imagen
con OpenCV y Tesseract. Si la placa esta registrada, el sistema la asocia al usuario
correspondiente y registra la entrada o salida segun el estado de la sesion.

Referencia de la API

Documentacion interactiva disponible en:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

Autenticacion

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| POST | /auth/registro | Crear cuenta de usuario |
| POST | /auth/login | Iniciar sesion; retorna JWT |

Ejemplo de login:
bash
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"correo": "admin@parqueadero.edu.co", "password": "admin123"}'


Mi cuenta (usuario autenticado)

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| GET | /cuenta/perfil | Obtener perfil propio |
| PUT | /cuenta/perfil | Actualizar nombre, telefono y documento |
| GET | /cuenta/vehiculo | Ver vehiculo registrado |
| POST | /cuenta/vehiculo | Registrar vehiculo con placa y tipo |
| PUT | /cuenta/vehiculo | Actualizar datos del vehiculo |
| GET | /cuenta/qr | Obtener QR de visita activo |
| POST | /cuenta/qr/generar | Generar nuevo QR (invalida el anterior) |
| GET | /cuenta/sesiones | Historial de sesiones propias |
| GET | /cuenta/facturas | Historial de facturas propias |
| GET | /cuenta/facturas/{id}/pdf | Descargar factura en PDF |

Sesiones (control de acceso)

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| POST | /sesiones/validar-qr | Escanear QR; registra entrada o salida y genera factura |
| POST | /sesiones/camara-placa | Registrar entrada o salida por placa mediante OCR |
| GET | /sesiones/activas | Listar sesiones activas en tiempo real (solo admin) |
| GET | /sesiones/historial | Historial completo de sesiones (solo admin) |

Administracion (requiere rol admin)

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| GET | /admin/cuentas | Listar todas las cuentas de usuario |
| PUT | /admin/cuentas/{id}/toggle | Activar o desactivar cuenta |
| GET | /admin/mensualidades | Listar mensualidades con conteo de usos |
| POST | /admin/mensualidades | Crear mensualidad, QR, factura y email |
| PUT | /admin/mensualidades/{id}/estado | Cambiar estado de mensualidad |
| GET | /admin/reportes/resumen | Resumen de ingresos por periodo |

OCR y QR

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| POST | /ocr/detectar-placa | Detectar placa en imagen (multipart/form-data) |
| POST | /qr/decodificar | Decodificar codigo QR desde imagen |

Modelo de datos

Entidades principales

CuentaUsuario (cuentas_usuario)
  correo · nombre · documento · password_hash · rol · activo
  |
  +--< VehiculoCuenta (vehiculos_cuenta)
  |      placa · marca · modelo · color · tipo_vehiculo
  |      |
  |      +--< QRParqueo (qr_parqueo)
  |             codigo · tipo (visita/mensualidad) · activo · imagen_b64
  |
  +--< SesionParqueo (sesiones_parqueo)
  |      placa · tipo · tipo_vehiculo
  |      entrada_at · salida_at · duracion_minutos · valor_cobrado · estado
  |
  +--< MensualidadV2 (mensualidades_v2)
  |      periodo · fecha_inicio · fecha_fin · monto · estado
  |
  +--< FacturaV2 (facturas_v2)
         numero · tipo · monto · descripcion · metodo_pago · estado

Logica de tarifas

Carro:        $100 COP/minuto · tope $30.000/dia
Motocicleta:  $50  COP/minuto · tope $15.000/dia
Mensualidad:  $0 (acceso libre dentro del periodo vigente)

Flujo de doble escaneo QR

Usuario llega
    |
Primer escaneo del QR
    |
    +-- Tipo "visita"      -> Registra sesion activa con hora de entrada
    |
    +-- Tipo "mensualidad" -> Verifica vigencia del periodo
                             Registra sesion sin cobro
    |
(tiempo en el parqueadero)
    |
Segundo escaneo del mismo QR
    |
    +-- Tipo "visita"      -> Calcula cobro: minutos x tarifa
                             Aplica tope diario segun tipo de vehiculo
                             Genera factura PDF
                             Envia email con adjunto
                             Sesion queda como "completada"
    |
    +-- Tipo "mensualidad" -> Registra salida con valor_cobrado = $0
                             Actualiza conteo de usos del periodo

Servicios internos

services/qr_service.py
- generar_codigo_unico(cuenta_id): genera un codigo UUID unico con prefijo del sistema
- generar_imagen_qr(codigo, nombre): crea imagen QR y retorna en base64

services/ocr_service.py
- procesar_imagen_bytes(bytes): pipeline multi-estrategia con preprocesamiento OpenCV
  (escala de grises, Otsu, adaptativo, escalado 2x), Tesseract con configuracion
  --psm 8 (palabra unica) y post-procesamiento con regex para placas colombianas

services/invoice_service.py
- generar_visita(...): PDF de factura de visita con datos del emisor, cliente, vehiculo, tabla de tiempo, totales y CUFE simulado
- generar_mensualidad(...): PDF de factura de mensualidad con periodo, vigencia, monto y CUFE simulado
- Usa fpdf2 (pure-Python, sin dependencias del sistema operativo)

services/email_service.py
- enviar_factura(...): email HTML con PDF adjunto al usuario tras registrar salida
- enviar_mensualidad(...): email de confirmacion al crear mensualidad
- enviar_alerta(...): notificaciones generales
- En modo demo (sin SMTP configurado) muestra el contenido en consola sin generar error

auth.py
- hash_password(pwd): hash bcrypt
- verificar_password(plain, hash): verificacion bcrypt
- crear_token(cuenta_id, rol): JWT HS256 con expiracion de 48 horas
- obtener_cuenta_actual: dependencia FastAPI que extrae y valida el token del header
- requerir_admin: dependencia que fuerza rol="admin" o lanza error 403

tz.py
- now_col(): retorna datetime.now(ZoneInfo("America/Bogota")) para que todos los timestamps sean en hora colombiana (UTC-5)


Tecnologias

| Capa | Tecnologia | Version | Rol |
|------|-----------|---------|-----|
| Frontend | React | 18 | UI reactiva con componentes funcionales |
| Frontend | Vite | 5 | Bundler y servidor de desarrollo con HMR |
| Frontend | React Router DOM | 6 | Enrutamiento SPA con rutas protegidas |
| Backend | FastAPI | 0.111 | Framework REST asincrono |
| Backend | Python | 3.11 | Lenguaje principal del backend |
| Backend | Uvicorn | 0.29 | Servidor ASGI con reload automatico |
| ORM | SQLAlchemy | 2.0 | Mapeo objeto-relacional |
| Base de datos | MySQL | 8.0 | Motor relacional principal |
| Autenticacion | python-jose + passlib | — | JWT HS256 y bcrypt |
| Validacion | Pydantic | v2 | Schemas de entrada y salida |
| OCR | Tesseract | 5.x | Reconocimiento de texto en imagenes |
| Vision | OpenCV | 4.9 | Procesamiento de imagenes |
| QR | qrcode[pil] | 7.4 | Generacion de codigos QR |
| PDF | fpdf2 | 2.7 | Generacion de documentos PDF |
| Email | smtplib | stdlib | Envio SMTP con TLS |
| Contenedores | Docker y Compose | — | Despliegue reproducible |



Seguridad implementada

- Contrasennas hasheadas con bcrypt (factor de costo 12)
- Tokens JWT HS256 con expiracion de 48 horas
- Rutas protegidas en el frontend (React Router) y en el backend (dependencias FastAPI)
- Validacion de formato de placa colombiana con regex: ^[A-Z]{3}[0-9]{2}[0-9A-Z]$
- Un vehiculo no puede tener dos sesiones activas simultaneas
- El usuario solo puede acceder a sus propias facturas (verificacion por cuenta_id)
- Claves secretas gestionadas mediante variables de entorno


Autores

Keizy Lizeth Cuadrado Amado | Estudiante Ingenieria de Sistemas
Julio Cesar Hernandez Monroy | Estudiante Ingenieria de Sistemas
Harry Alexander Velandia Bermudez | Profesor

Desarrollo apoyado con Claude Code

Fundacion Universitaria Unimonserrate
Ingenieria en Sistemas — 6to semestre — 2026

Proyecto academico. La facturacion es simulada y no tiene validez fiscal ante la DIAN.
