"""
services/email_service.py
Servicio de envío de correos electrónicos via SMTP.
Si no hay SMTP configurado, registra en consola (modo demo).
"""
import os
import smtplib
import logging
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders

logger = logging.getLogger(__name__)

def _smtp_cfg():
    """Lee la configuración SMTP en cada llamada para reflejar cambios de entorno."""
    return {
        "host":      os.getenv("SMTP_HOST",      ""),
        "port":      int(os.getenv("SMTP_PORT",  "587")),
        "user":      os.getenv("SMTP_USER",      ""),
        "password":  os.getenv("SMTP_PASSWORD",  ""),
        "from_addr": os.getenv("MAIL_FROM",      "noreply@parqueadero.edu.co"),
        "from_name": os.getenv("MAIL_FROM_NAME", "Parqueadero Unimonserrate"),
    }


def _formato_cop(valor: float) -> str:
    return f"${valor:,.0f} COP"


def _html_base(titulo: str, contenido: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>
    body {{ font-family: Arial, sans-serif; background:#f4f6f9; margin:0; padding:20px; }}
    .container {{ background:#fff; max-width:600px; margin:0 auto; border-radius:8px;
                  box-shadow:0 2px 8px rgba(0,0,0,.1); overflow:hidden; }}
    .header {{ background:#1a2744; color:#fff; padding:24px 32px; }}
    .header h1 {{ margin:0; font-size:22px; }}
    .header p {{ margin:4px 0 0; opacity:.7; font-size:13px; }}
    .body {{ padding:32px; color:#333; line-height:1.6; }}
    .highlight {{ background:#f0f4ff; border-left:4px solid #1a2744;
                  padding:16px 20px; border-radius:0 6px 6px 0; margin:20px 0; }}
    .amount {{ font-size:28px; color:#1a2744; font-weight:bold; text-align:center;
               padding:16px; background:#f0f4ff; border-radius:8px; margin:20px 0; }}
    table {{ width:100%; border-collapse:collapse; margin:16px 0; }}
    td {{ padding:8px 12px; border-bottom:1px solid #eee; font-size:14px; }}
    td:first-child {{ color:#666; width:40%; }}
    td:last-child {{ font-weight:500; }}
    .footer {{ background:#f0f4ff; padding:16px 32px; font-size:12px; color:#666;
               text-align:center; }}
    .badge {{ display:inline-block; padding:4px 12px; border-radius:12px;
              background:#1a2744; color:#fff; font-size:12px; font-weight:bold; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚗 Parqueadero Unimonserrate</h1>
      <p>{titulo}</p>
    </div>
    <div class="body">{contenido}</div>
    <div class="footer">
      Sistema Inteligente de Parqueadero · Fundación Universitaria Unimonserrate<br>
      Este es un correo automático, no responder.
    </div>
  </div>
</body>
</html>"""


class EmailService:
    def _enviar(self, destinatario: str, asunto: str, html: str,
                adjunto_bytes: bytes = None, adjunto_nombre: str = None) -> bool:
        cfg = _smtp_cfg()

        if not cfg["host"] or not cfg["user"]:
            logger.info(
                "[EMAIL-DEMO] Para: %s | Asunto: %s\n%s",
                destinatario, asunto,
                html[:300].replace("\n", " ")
            )
            return False  # No configurado

        try:
            msg = MIMEMultipart("mixed")
            msg["Subject"] = asunto
            msg["From"]    = f"{cfg['from_name']} <{cfg['from_addr']}>"
            msg["To"]      = destinatario

            # Parte HTML
            msg.attach(MIMEText(html, "html", "utf-8"))

            # Adjunto PDF si se provee
            if adjunto_bytes and adjunto_nombre:
                parte = MIMEBase("application", "pdf")
                parte.set_payload(adjunto_bytes)
                encoders.encode_base64(parte)
                parte.add_header(
                    "Content-Disposition",
                    f'attachment; filename="{adjunto_nombre}"',
                )
                msg.attach(parte)

            with smtplib.SMTP(cfg["host"], cfg["port"], timeout=15) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(cfg["user"], cfg["password"])
                server.sendmail(cfg["from_addr"], destinatario, msg.as_string())
            logger.info("✉ Email%s enviado a %s [%s]",
                        f" +PDF({adjunto_nombre})" if adjunto_bytes else "",
                        destinatario, asunto)
            return True
        except smtplib.SMTPAuthenticationError:
            logger.error("SMTP Auth fallida para %s — verifica contraseña de aplicación", cfg["user"])
            return False
        except Exception as exc:
            logger.error("Error enviando email a %s: %s", destinatario, exc)
            return False

    async def enviar_factura(
        self,
        correo: str,
        nombre: str,
        doc_cliente: str,
        numero: str,
        placa: str,
        entrada: datetime,
        salida: datetime,
        duracion: str,
        minutos: int,
        monto: float,
        pdf_bytes: bytes = None,
    ) -> bool:
        fmt = "%d/%m/%Y %H:%M"
        contenido = f"""
<p>Hola <strong>{nombre}</strong>,</p>
<p>Tu visita al parqueadero ha finalizado. Se adjunta tu <strong>factura electrónica</strong>:</p>

<div class="amount">{_formato_cop(monto)}</div>

<table>
  <tr><td>N° Factura</td><td><span class="badge">{numero}</span></td></tr>
  <tr><td>Placa</td><td><strong>{placa}</strong></td></tr>
  <tr><td>Entrada</td><td>{entrada.strftime(fmt)}</td></tr>
  <tr><td>Salida</td><td>{salida.strftime(fmt)}</td></tr>
  <tr><td>Duración</td><td>{duracion}</td></tr>
  <tr><td>Total cobrado</td><td><strong>{_formato_cop(monto)}</strong></td></tr>
  <tr><td>IVA</td><td>$0 (exento)</td></tr>
</table>

<div class="highlight">
  📎 Se adjunta la factura en formato PDF para tus registros.
</div>

<p style="color:#666;font-size:13px;">
  ¡Gracias por usar el parqueadero de Unimonserrate! 🚗
</p>"""
        return self._enviar(
            correo,
            f"Factura {numero} — Parqueadero Unimonserrate",
            _html_base(f"Factura #{numero}", contenido),
            adjunto_bytes=pdf_bytes,
            adjunto_nombre=f"Factura_{numero}.pdf" if pdf_bytes else None,
        )

    async def enviar_mensualidad(
        self,
        correo: str,
        nombre: str,
        doc_cliente: str,
        numero: str,
        periodo: str,
        fecha_inicio,
        fecha_fin,
        monto: float,
        pdf_bytes: bytes = None,
    ) -> bool:
        contenido = f"""
<p>Hola <strong>{nombre}</strong>,</p>
<p>Tu mensualidad del parqueadero ha sido activada. Se adjunta tu <strong>factura electrónica</strong>:</p>

<div class="highlight">
  <strong>Periodo:</strong> {periodo} &nbsp;|&nbsp;
  <strong>Válido hasta:</strong> {fecha_fin}
</div>

<table>
  <tr><td>N° Factura</td><td><span class="badge">{numero}</span></td></tr>
  <tr><td>Periodo</td><td>{periodo}</td></tr>
  <tr><td>Inicio</td><td>{fecha_inicio}</td></tr>
  <tr><td>Fin</td><td>{fecha_fin}</td></tr>
  <tr><td>Monto pagado</td><td><strong>{_formato_cop(monto)}</strong></td></tr>
  <tr><td>IVA</td><td>$0 (exento)</td></tr>
</table>

<div class="highlight">
  📎 Se adjunta la factura en formato PDF para tus registros.<br>
  Descarga tu <strong>QR de acceso</strong> desde el panel del administrador.
</div>"""
        return self._enviar(
            correo,
            f"Mensualidad activada {periodo} — {numero} — Parqueadero Unimonserrate",
            _html_base("Confirmación de mensualidad", contenido),
            adjunto_bytes=pdf_bytes,
            adjunto_nombre=f"Factura_{numero}.pdf" if pdf_bytes else None,
        )

    async def enviar_alerta(
        self,
        correo: str,
        nombre: str,
        asunto: str,
        mensaje: str,
    ) -> bool:
        contenido = f"""
<p>Hola <strong>{nombre}</strong>,</p>
<div class="highlight">{mensaje}</div>
<p style="color:#666;font-size:13px;">
  Si tienes dudas, comunícate con la administración del parqueadero.
</p>"""
        return self._enviar(
            correo,
            f"[Parqueadero Unimonserrate] {asunto}",
            _html_base("Notificación del Parqueadero", contenido),
        )


# Singleton
email_service = EmailService()
