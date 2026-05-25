import os
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import numpy as np
import cv2

from database import engine, Base, SessionLocal
from models import CuentaUsuario

# Routers legacy
from routers.usuarios    import router as router_usuarios
from routers.ingresos    import router as router_ingresos
from routers.mensualidades import router as router_mensualidades
from routers.mensualidades import reportes_router

# Routers v2
from routers.auth     import router as router_auth
from routers.cuenta   import router as router_cuenta
from routers.sesiones import router as router_sesiones
from routers.admin    import router as router_admin

from services.ocr_service import ocr_service
from auth import hash_password

Base.metadata.create_all(bind=engine)

def _seed_admin():
    db = SessionLocal()
    try:
        admin_correo = os.getenv("ADMIN_EMAIL", "admin@parqueadero.edu.co")
        admin_pass   = os.getenv("ADMIN_PASSWORD", "admin123")

        exists = db.query(CuentaUsuario).filter(
            CuentaUsuario.correo == admin_correo
        ).first()
        if not exists:
            admin = CuentaUsuario(
                correo=admin_correo,
                nombre="Administrador",
                password_hash=hash_password(admin_pass),
                rol="admin",
                activo=1,
            )
            db.add(admin)
            db.commit()
            print(f"[SEED] Admin creado: {admin_correo} / {admin_pass}")
    except Exception as e:
        print(f"[SEED] Error: {e}")
    finally:
        db.close()

_seed_admin()

app = FastAPI(
    title="Sistema Inteligente de Parqueadero — Unimonserrate",
    description=(
        "API REST para control automatizado de acceso vehicular: "
        "autenticación JWT, QR de entrada/salida, OCR de placas, "
        "facturación, mensualidades y reportes."
    ),
    version="2.0.0",
    contact={
        "name":  "Ingeniería en Software — Unimonserrate",
        "email": "ingenieria@unimonserrate.edu.co",
    },
)

#CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

#Registrar routers v
app.include_router(router_auth)
app.include_router(router_cuenta)
app.include_router(router_sesiones)
app.include_router(router_admin)

#Registrar routers legacy
app.include_router(router_usuarios)
app.include_router(router_ingresos)
app.include_router(router_mensualidades)
app.include_router(reportes_router)

#Root
@app.get("/", tags=["Root"])
def raiz():
    return {
        "sistema":  "Parqueadero Inteligente Unimonserrate",
        "version":  "2.0.0",
        "estado":   "operativo",
        "docs":     "/docs",
        "admin":    "admin@parqueadero.edu.co / admin123",
    }

@app.get("/health", tags=["Root"])
def health():
    return {"status": "ok"}

#OCR endpoint
@app.post("/ocr/detectar-placa", tags=["OCR"])
async def detectar_placa(imagen: UploadFile = File(...)):
    """Recibe imagen y retorna placa detectada via OCR multi-estrategia."""
    contenido = await imagen.read()
    resultado = ocr_service.procesar_imagen_bytes(contenido)
    return resultado

#QR decode desde imagen
@app.post("/qr/decodificar", tags=["QR"])
async def decodificar_qr_imagen(imagen: UploadFile = File(...)):
    """Decodifica un código QR desde imagen subida."""
    contenido = await imagen.read()
    nparr = np.frombuffer(contenido, np.uint8)
    img   = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        raise HTTPException(status_code=400, detail="No se pudo decodificar la imagen")

    detector = cv2.QRCodeDetector()

    datos, _, _ = detector.detectAndDecode(img)
    if datos:
        return {"codigo": datos, "detectado": True}

    gris       = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    candidatos = []

    _, otsu = cv2.threshold(gris, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    candidatos.append(otsu)
    candidatos.append(cv2.bitwise_not(otsu))

    ada = cv2.adaptiveThreshold(gris, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                 cv2.THRESH_BINARY, 11, 2)
    candidatos.append(ada)

    grande = cv2.resize(gris, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
    candidatos.append(grande)

    for c in candidatos:
        try:
            bgr  = cv2.cvtColor(c, cv2.COLOR_GRAY2BGR)
            datos, _, _ = detector.detectAndDecode(bgr)
            if datos:
                return {"codigo": datos, "detectado": True}
        except Exception:
            continue

    return {"codigo": None, "detectado": False,
            "motivo": "No se detectó código QR en la imagen"}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
