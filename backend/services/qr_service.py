"""
services/qr_service.py
Generación y validación de códigos QR para ingreso de usuarios
"""
import uuid
import base64
import io
import qrcode
from qrcode.image.styledpil import StyledPilImage
from qrcode.image.styles.moduledrawers import RoundedModuleDrawer
from PIL import Image
from datetime import datetime, timedelta


class QRService:
    """
    Genera códigos QR únicos para usuarios registrados
    y los valida al momento de ingresar al parqueadero.
    """

    def generar_codigo_unico(self, usuario_id: int) -> str:
        """
        Genera un token UUID único vinculado al usuario.
        Formato: USR{usuario_id}-{uuid4}
        """
        token = str(uuid.uuid4()).replace("-", "").upper()
        return f"PKG-{usuario_id}-{token[:16]}"

    def generar_imagen_qr(self, codigo: str, nombre_usuario: str = "") -> str:
        """
        Genera imagen QR en base64.
        Retorna string base64 de la imagen PNG.
        """
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=10,
            border=4,
        )
        qr.add_data(codigo)
        qr.make(fit=True)

        img = qr.make_image(
            image_factory=StyledPilImage,
            module_drawer=RoundedModuleDrawer(),
            fill_color="#1a2744",
            back_color="white"
        )

        # Convertir a base64
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        buffer.seek(0)
        img_b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

        return img_b64

    def validar_codigo_formato(self, codigo: str) -> bool:
        """Valida que el código tenga el formato correcto."""
        partes = codigo.split("-")
        if len(partes) != 3:
            return False
        prefijo, usuario_id, token = partes
        return (
            prefijo == "PKG"
            and usuario_id.isdigit()
            and len(token) == 16
        )

    def extraer_usuario_id(self, codigo: str) -> int | None:
        """Extrae el ID de usuario de un código QR válido."""
        if not self.validar_codigo_formato(codigo):
            return None
        partes = codigo.split("-")
        return int(partes[1])


# Instancia singleton
qr_service = QRService()
