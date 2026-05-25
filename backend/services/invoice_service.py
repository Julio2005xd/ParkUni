"""
services/invoice_service.py
Genera facturas electrónicas simuladas en PDF (formato colombiano DIAN-inspired).
Usa fpdf2 (pure-Python, sin dependencias de sistema).
"""
import io
import hashlib
from datetime import datetime
from typing import Optional
from tz import now_col

try:
    from fpdf import FPDF
    FPDF_OK = True
except ImportError:
    FPDF_OK = False

# ── Constantes del emisor ─────────────────────────────────────────
EMISOR = {
    "nombre":     "Fundación Universitaria Unimonserrate",
    "nit":        "860.006.798-9",
    "direccion":  "Cra. 5 No. 117 - 50, Bogotá D.C.",
    "telefono":   "+57 (601) 345 4000",
    "email":      "parqueadero@unimonserrate.edu.co",
    "regimen":    "Responsable de IVA - Gran Contribuyente",
    "actividad":  "8010 - Servicios de estacionamiento y parqueo",
}

COLORES = {
    "navy":  (13,  27, 53),
    "blue":  (26, 110, 216),
    "gold":  (200, 168, 75),
    "gray":  (90, 106, 133),
    "light": (240, 244, 249),
    "white": (255, 255, 255),
    "black": (13,  27, 53),
}


def _cufe_simulado(numero: str, monto: float, nit_emisor: str) -> str:
    """CUFE simulado (hash SHA256 de datos clave, truncado a 48 chars)."""
    raw = f"{numero}{monto:.2f}{nit_emisor}{now_col().isoformat()}"
    return hashlib.sha256(raw.encode()).hexdigest()[:48]


class InvoiceService:

    def _nueva_pagina(self, pdf: "FPDF") -> None:
        """Encabezado en cada página."""
        pdf.set_fill_color(*COLORES["navy"])
        pdf.rect(0, 0, 210, 28, "F")
        pdf.set_xy(12, 7)
        pdf.set_text_color(*COLORES["white"])
        pdf.set_font("Helvetica", "B", 14)
        pdf.cell(0, 7, "Parqueadero Unimonserrate", ln=True)
        pdf.set_x(12)
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(*COLORES["gold"])
        pdf.cell(0, 5, "Factura Electronica de Venta - Documento Tributario Simulado", ln=True)
        pdf.set_text_color(*COLORES["black"])

    def _linea_h(self, pdf: "FPDF", y: float, color=None) -> None:
        color = color or COLORES["light"]
        pdf.set_draw_color(*color)
        pdf.line(12, y, 198, y)
        pdf.set_draw_color(0, 0, 0)

    def _fila_tabla(self, pdf: "FPDF", cols: list, widths: list,
                    bold=False, bg=None) -> None:
        if bg:
            pdf.set_fill_color(*bg)
            pdf.rect(12, pdf.get_y(), sum(widths), 7, "F")
        pdf.set_font("Helvetica", "B" if bold else "", 9)
        x0 = 12
        for txt, w in zip(cols, widths):
            pdf.set_xy(x0, pdf.get_y())
            pdf.cell(w, 7, str(txt), border=0, ln=0)
            x0 += w
        pdf.ln(7)

    # ── Factura de VISITA ─────────────────────────────────────────

    def generar_visita(
        self,
        numero: str,
        nombre_cliente: str,
        doc_cliente: str,
        correo_cliente: str,
        placa: str,
        entrada: datetime,
        salida: datetime,
        duracion_str: str,
        minutos: int,
        valor: float,
    ) -> bytes:
        if not FPDF_OK:
            return b""

        pdf = FPDF(orientation="P", unit="mm", format="A4")
        pdf.add_page()
        pdf.set_auto_page_break(auto=True, margin=15)
        self._nueva_pagina(pdf)

        # ── Bloque emisor + número factura ──
        pdf.set_xy(12, 33)
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(*COLORES["navy"])
        pdf.cell(100, 5, EMISOR["nombre"], ln=False)

        # Caja derecha: número de factura
        pdf.set_fill_color(*COLORES["gold"])
        pdf.rect(138, 32, 60, 22, "F")
        pdf.set_xy(140, 34)
        pdf.set_text_color(*COLORES["white"])
        pdf.set_font("Helvetica", "B", 8)
        pdf.cell(56, 5, "FACTURA ELECTRÓNICA", ln=True, align="C")
        pdf.set_xy(140, 39)
        pdf.set_font("Helvetica", "B", 12)
        pdf.cell(56, 7, numero, ln=True, align="C")
        pdf.set_xy(140, 47)
        pdf.set_font("Helvetica", "", 7)
        pdf.cell(56, 4, salida.strftime("%d/%m/%Y %H:%M"), ln=True, align="C")

        # Datos emisor
        pdf.set_text_color(*COLORES["gray"])
        pdf.set_font("Helvetica", "", 8)
        datos_emisor = [
            f"NIT: {EMISOR['nit']}",
            EMISOR["direccion"],
            EMISOR["telefono"],
            EMISOR["email"],
            EMISOR["regimen"],
        ]
        pdf.set_xy(12, 39)
        for d in datos_emisor:
            pdf.cell(120, 4, d, ln=True)
            pdf.set_x(12)

        pdf.set_y(58)
        self._linea_h(pdf, pdf.get_y(), COLORES["navy"])
        pdf.ln(3)

        # ── Bloque comprador ──
        pdf.set_fill_color(*COLORES["light"])
        pdf.rect(12, pdf.get_y(), 186, 22, "F")
        pdf.set_xy(14, pdf.get_y() + 2)
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_text_color(*COLORES["navy"])
        pdf.cell(90, 5, "DATOS DEL CLIENTE", ln=False)
        pdf.set_font("Helvetica", "B", 9)
        pdf.cell(90, 5, "DATOS DEL VEHÍCULO", ln=True)
        pdf.set_x(14)
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(*COLORES["gray"])
        pdf.cell(90, 4, f"Nombre: {nombre_cliente}", ln=False)
        pdf.cell(90, 4, f"Placa:  {placa}", ln=True)
        pdf.set_x(14)
        pdf.cell(90, 4, f"Documento: {doc_cliente or 'N/A'}", ln=False)
        pdf.cell(90, 4, f"Entrada: {entrada.strftime('%d/%m/%Y %H:%M')}", ln=True)
        pdf.set_x(14)
        pdf.cell(90, 4, f"Correo: {correo_cliente}", ln=False)
        pdf.cell(90, 4, f"Salida:  {salida.strftime('%d/%m/%Y %H:%M')}", ln=True)
        pdf.ln(5)

        # ── Tabla de conceptos ──
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_text_color(*COLORES["white"])
        self._fila_tabla(pdf,
            ["Cant.", "Descripción del servicio", "Und.", "V. Unitario", "V. Total"],
            [15, 95, 15, 30, 31],
            bold=True, bg=COLORES["navy"])

        pdf.set_text_color(*COLORES["black"])
        horas = minutos // 60
        mins  = minutos % 60
        desc  = f"Servicio de parqueo - {horas}h {mins}min - placa {placa}"
        tarifa_min = valor / max(1, minutos)
        self._fila_tabla(pdf,
            [f"{minutos}", desc, "min", f"${tarifa_min:,.1f}", f"${valor:,.0f}"],
            [15, 95, 15, 30, 31])

        # Fila IVA (exento)
        self._fila_tabla(pdf,
            ["", "IVA (exento - Art. 476 E.T.)", "", "0%", "$0"],
            [15, 95, 15, 30, 31], bg=COLORES["light"])

        pdf.ln(2)
        self._linea_h(pdf, pdf.get_y())
        pdf.ln(2)

        # ── Totales ──
        totales = [
            ("Subtotal:",    f"${valor:,.0f} COP"),
            ("Descuentos:",  "$0"),
            ("IVA:",         "$0 (exento)"),
            ("TOTAL A PAGAR:", f"${valor:,.0f} COP"),
        ]
        for label, val in totales:
            pdf.set_x(130)
            bold = "TOTAL" in label
            pdf.set_font("Helvetica", "B" if bold else "", 9)
            if bold:
                pdf.set_text_color(*COLORES["navy"])
                pdf.set_fill_color(*COLORES["light"])
                pdf.rect(130, pdf.get_y(), 68, 7, "F")
            else:
                pdf.set_text_color(*COLORES["gray"])
            pdf.cell(42, 7, label, border=0, ln=False)
            pdf.cell(26, 7, val, border=0, ln=True, align="R")

        pdf.ln(5)
        self._linea_h(pdf, pdf.get_y())
        pdf.ln(3)

        # ── CUFE simulado ──
        cufe = _cufe_simulado(numero, valor, EMISOR["nit"])
        pdf.set_font("Helvetica", "", 6.5)
        pdf.set_text_color(*COLORES["gray"])
        pdf.set_x(12)
        pdf.cell(0, 4, f"CUFE (simulado): {cufe}", ln=True)
        pdf.set_x(12)
        pdf.cell(0, 4, "Documento generado por sistema de facturacion simulada - no tiene validez fiscal ante la DIAN.", ln=True)

        # ── Nota de pago ──
        pdf.ln(3)
        pdf.set_fill_color(*COLORES["light"])
        pdf.set_x(12)
        pdf.set_font("Helvetica", "B", 8)
        pdf.set_text_color(*COLORES["navy"])
        pdf.cell(0, 5, f"  Servicio completado  |  Duracion: {duracion_str}  |  Total: ${valor:,.0f} COP", ln=True, fill=True)

        # ── Pie de página ──
        pdf.set_y(-18)
        pdf.set_fill_color(*COLORES["navy"])
        pdf.rect(0, pdf.get_y(), 210, 18, "F")
        pdf.set_font("Helvetica", "", 7)
        pdf.set_text_color(*COLORES["white"])
        pdf.set_x(12)
        pdf.cell(0, 5, "Parqueadero Unimonserrate  |  Cra. 5 No. 117-50, Bogota  |  parqueadero@unimonserrate.edu.co", ln=True, align="C")
        pdf.set_x(12)
        pdf.set_text_color(*COLORES["gold"])
        pdf.cell(0, 4, "Este es un documento de facturacion simulada generado automaticamente. No es valido como soporte tributario.", ln=True, align="C")

        buf = io.BytesIO()
        pdf.output(buf)
        return buf.getvalue()

    # ── Factura de MENSUALIDAD ────────────────────────────────────

    def generar_mensualidad(
        self,
        numero: str,
        nombre_cliente: str,
        doc_cliente: str,
        correo_cliente: str,
        periodo: str,
        fecha_inicio,
        fecha_fin,
        monto: float,
    ) -> bytes:
        if not FPDF_OK:
            return b""

        pdf = FPDF(orientation="P", unit="mm", format="A4")
        pdf.add_page()
        pdf.set_auto_page_break(auto=True, margin=15)
        self._nueva_pagina(pdf)

        # Número factura
        pdf.set_fill_color(*COLORES["gold"])
        pdf.rect(138, 32, 60, 22, "F")
        pdf.set_xy(140, 34)
        pdf.set_text_color(*COLORES["white"])
        pdf.set_font("Helvetica", "B", 8)
        pdf.cell(56, 5, "FACTURA MENSUALIDAD", ln=True, align="C")
        pdf.set_xy(140, 39)
        pdf.set_font("Helvetica", "B", 12)
        pdf.cell(56, 7, numero, ln=True, align="C")
        pdf.set_xy(140, 47)
        pdf.set_font("Helvetica", "", 7)
        pdf.cell(56, 4, f"Periodo: {periodo}", ln=True, align="C")

        # Datos emisor
        pdf.set_xy(12, 33)
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(*COLORES["navy"])
        pdf.cell(120, 5, EMISOR["nombre"], ln=True)
        pdf.set_x(12)
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(*COLORES["gray"])
        for d in [f"NIT: {EMISOR['nit']}", EMISOR["direccion"], EMISOR["telefono"]]:
            pdf.cell(120, 4, d, ln=True)
            pdf.set_x(12)

        pdf.set_y(58)
        self._linea_h(pdf, pdf.get_y(), COLORES["navy"])
        pdf.ln(3)

        # Comprador
        pdf.set_fill_color(*COLORES["light"])
        pdf.rect(12, pdf.get_y(), 186, 18, "F")
        pdf.set_xy(14, pdf.get_y() + 2)
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_text_color(*COLORES["navy"])
        pdf.cell(0, 5, "DATOS DEL SUSCRIPTOR", ln=True)
        pdf.set_x(14)
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(*COLORES["gray"])
        pdf.cell(90, 4, f"Nombre: {nombre_cliente}    Doc: {doc_cliente or 'N/A'}", ln=False)
        pdf.cell(90, 4, f"Correo: {correo_cliente}", ln=True)
        pdf.ln(6)

        # Tabla
        self._fila_tabla(pdf,
            ["Cant.", "Descripción", "Periodo", "V. Unitario", "V. Total"],
            [15, 80, 30, 30, 31],
            bold=True, bg=COLORES["navy"])
        pdf.set_text_color(*COLORES["black"])
        self._fila_tabla(pdf,
            ["1", "Suscripción mensual de parqueadero", periodo, f"${monto:,.0f}", f"${monto:,.0f}"],
            [15, 80, 30, 30, 31])
        self._fila_tabla(pdf,
            ["", "IVA (exento - servicio educativo)", "", "0%", "$0"],
            [15, 80, 30, 30, 31], bg=COLORES["light"])
        pdf.ln(2)
        self._linea_h(pdf, pdf.get_y())
        pdf.ln(2)

        # Totales
        pdf.set_x(130)
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(*COLORES["navy"])
        pdf.set_fill_color(*COLORES["light"])
        pdf.rect(130, pdf.get_y(), 68, 8, "F")
        pdf.cell(42, 8, "TOTAL:", border=0, ln=False)
        pdf.cell(26, 8, f"${monto:,.0f} COP", border=0, ln=True, align="R")
        pdf.ln(3)

        # Vigencia
        pdf.set_x(12)
        pdf.set_fill_color(*COLORES["light"])
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_text_color(*COLORES["navy"])
        pdf.cell(0, 6, f"  Vigencia: {fecha_inicio} al {fecha_fin}  |  Periodo: {periodo}", ln=True, fill=True)

        # CUFE
        pdf.ln(4)
        cufe = _cufe_simulado(numero, monto, EMISOR["nit"])
        pdf.set_font("Helvetica", "", 6.5)
        pdf.set_text_color(*COLORES["gray"])
        pdf.set_x(12)
        pdf.cell(0, 4, f"CUFE (simulado): {cufe}", ln=True)
        pdf.set_x(12)
        pdf.cell(0, 4, "Documento generado por sistema de facturacion simulada - no tiene validez fiscal ante la DIAN.", ln=True)

        # Pie
        pdf.set_y(-18)
        pdf.set_fill_color(*COLORES["navy"])
        pdf.rect(0, pdf.get_y(), 210, 18, "F")
        pdf.set_font("Helvetica", "", 7)
        pdf.set_text_color(*COLORES["white"])
        pdf.set_x(12)
        pdf.cell(0, 5, "Parqueadero Unimonserrate  |  Cra. 5 No. 117-50, Bogota  |  parqueadero@unimonserrate.edu.co", align="C", ln=True)
        pdf.set_x(12)
        pdf.set_text_color(*COLORES["gold"])
        pdf.cell(0, 4, "Documento de facturacion simulada - no valido ante la DIAN.", align="C", ln=True)

        buf = io.BytesIO()
        pdf.output(buf)
        return buf.getvalue()


# Singleton
invoice_service = InvoiceService()
