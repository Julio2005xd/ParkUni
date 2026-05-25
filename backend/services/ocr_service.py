"""
services/ocr_service.py — OCR de placas colombianas v2
Mejoras vs v1:
  • Detección de placas BLANCAS/GRISES (antes solo amarillas)
  • Upscale agresivo a 800px mínimo antes de Tesseract
  • Corrección posicional de caracteres (pos 1-3 = letras, 4-5 = dígitos)
  • Confianza basada en patrón, no solo en Tesseract (resuelve el <10% conf)
  • Votación por carácter entre múltiples pasadas OCR
  • Más variantes de preprocesamiento
"""
import re
import base64
import cv2
import numpy as np
import pytesseract
from PIL import Image
from collections import Counter
from typing import Optional, Tuple, List


# ── Tablas de corrección posicional ──────────────────────────────
# Posiciones 0-2 DEBEN ser letras → convertir dígitos visualmente similares
_DIG_A_LETRA = {"0": "O", "1": "I", "5": "S", "8": "B", "6": "G", "2": "Z", "7": "T", "4": "A"}
# Posiciones 3-4 DEBEN ser dígitos → convertir letras visualmente similares
_LETRA_A_DIG  = {"O": "0", "Q": "0", "D": "0", "I": "1", "L": "1",
                 "S": "5", "B": "8", "G": "6", "Z": "2", "T": "7",
                 "A": "4", "J": "1", "U": "0"}


class OCRService:
    """
    Detecta y lee placas colombianas (ABC123 o ABC12D).
    Pipeline: detectar región → escalar → preprocesar → OCR multi-config → corregir → votar.
    """

    PATRON_PLACA = re.compile(r"[A-Z]{3}[0-9]{2}[0-9A-Z]")

    TESS_CONFIGS = [
        "--oem 3 --psm 7 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
        "--oem 3 --psm 8 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
        "--oem 3 --psm 6 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
        "--oem 3 --psm 13 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
    ]

    # ── Utilidades básicas ────────────────────────────────────────

    def _a_bgr(self, img: np.ndarray) -> np.ndarray:
        if len(img.shape) == 2:
            return cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
        return img

    def _a_gris(self, img: np.ndarray) -> np.ndarray:
        if len(img.shape) == 3:
            return cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        return img.copy()

    def _escalar(self, img: np.ndarray, min_w: int = 800) -> np.ndarray:
        """Upscale la imagen para que Tesseract tenga suficiente resolución."""
        h, w = img.shape[:2]
        if w < min_w:
            factor = min_w / w
            img = cv2.resize(img, None, fx=factor, fy=factor,
                             interpolation=cv2.INTER_LANCZOS4)
        # También upscale si la altura es muy pequeña
        h2, w2 = img.shape[:2]
        if h2 < 80:
            factor = 80 / h2
            img = cv2.resize(img, None, fx=factor, fy=factor,
                             interpolation=cv2.INTER_LANCZOS4)
        return img

    # ── Detección de región de placa ──────────────────────────────

    def _region_por_color_amarillo(self, img: np.ndarray) -> Optional[np.ndarray]:
        """Detecta placa amarilla colombiana (motos) por color HSV."""
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        mask = cv2.inRange(hsv, np.array([15, 60, 80]), np.array([45, 255, 255]))
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (7, 7))
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
        contornos, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        return self._mejor_contorno_placa(img, contornos, rel_min=1.5, rel_max=7.0, w_min=60, h_min=15)

    def _region_por_color_blanco(self, img: np.ndarray) -> Optional[np.ndarray]:
        """Detecta placa blanca/gris (particulares Colombia) buscando rectángulo claro."""
        gris = self._a_gris(img)
        # Equalizar contraste primero
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        gris = clahe.apply(gris)
        # Umbral para zonas claras
        _, mask = cv2.threshold(gris, 160, 255, cv2.THRESH_BINARY)
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (9, 5))
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
        contornos, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        return self._mejor_contorno_placa(img, contornos, rel_min=2.0, rel_max=6.5, w_min=80, h_min=20)

    def _region_por_contornos(self, img: np.ndarray) -> Optional[np.ndarray]:
        """Busca rectángulo de proporciones de placa por bordes Canny."""
        gris = self._a_gris(img)
        suave = cv2.bilateralFilter(gris, 9, 75, 75)
        bordes = cv2.Canny(suave, 30, 200)
        bordes = cv2.dilate(bordes, np.ones((3, 3), np.uint8), iterations=2)
        contornos, _ = cv2.findContours(bordes, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
        candidatos = sorted(contornos, key=cv2.contourArea, reverse=True)[:80]
        return self._mejor_contorno_placa(img, candidatos, rel_min=2.0, rel_max=7.0, w_min=80, h_min=20, poly=True)

    def _mejor_contorno_placa(self, img, contornos, rel_min, rel_max, w_min, h_min, poly=False, pad=8) -> Optional[np.ndarray]:
        ih, iw = img.shape[:2]
        for c in sorted(contornos, key=cv2.contourArea, reverse=True):
            area = cv2.contourArea(c)
            if area < 400:
                continue
            if poly:
                per = cv2.arcLength(c, True)
                approx = cv2.approxPolyDP(c, 0.02 * per, True)
                if not (4 <= len(approx) <= 8):
                    continue
            x, y, w, h = cv2.boundingRect(c)
            if h == 0:
                continue
            rel = w / h
            if rel_min <= rel <= rel_max and w > w_min and h > h_min:
                # No tomar más del 80% de la imagen (evitar falsos positivos grandes)
                if w > iw * 0.85 or h > ih * 0.85:
                    continue
                x1 = max(0, x - pad)
                y1 = max(0, y - pad)
                x2 = min(iw, x + w + pad)
                y2 = min(ih, y + h + pad)
                return img[y1:y2, x1:x2]
        return None

    # ── Preprocesamientos ─────────────────────────────────────────

    def _preprocesamientos(self, gris: np.ndarray) -> List[np.ndarray]:
        """Genera ~10 variantes de imagen para maximizar lecturas correctas."""
        base = self._escalar(gris)
        imgs = []

        # 1. CLAHE + Otsu
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        eq = clahe.apply(base)
        _, otsu = cv2.threshold(eq, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        imgs.append(otsu)
        imgs.append(cv2.bitwise_not(otsu))

        # 2. Bilateral + adaptativo gaussiano
        filt = cv2.bilateralFilter(base, 11, 17, 17)
        ada = cv2.adaptiveThreshold(filt, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                    cv2.THRESH_BINARY, 15, 4)
        imgs.append(ada)
        imgs.append(cv2.bitwise_not(ada))

        # 3. Sharpening previo a Otsu
        kernel_sharp = np.array([[0, -1, 0], [-1, 6, -1], [0, -1, 0]])
        sharp = cv2.filter2D(base, -1, kernel_sharp)
        _, otsu_s = cv2.threshold(sharp, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        imgs.append(otsu_s)

        # 4. Morphological opening después de threshold (limpia ruido)
        kernel_m = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        otsu_clean = cv2.morphologyEx(otsu, cv2.MORPH_OPEN, kernel_m)
        imgs.append(otsu_clean)
        imgs.append(cv2.bitwise_not(otsu_clean))

        # 5. Solo CLAHE (sin threshold — para OCR LSTM)
        imgs.append(eq)

        # 6. Imagen base sin procesar
        imgs.append(base)

        return imgs

    # ── Corrección posicional ─────────────────────────────────────

    def _corregir_placa(self, texto: str) -> Optional[str]:
        """
        Aplica corrección por posición:
          - pos 0-2: deben ser letras (convierte dígitos similares)
          - pos 3-4: deben ser dígitos (convierte letras similares)
          - pos 5:   puede ser letra o dígito
        """
        if len(texto) < 6:
            return None
        # Tomar los primeros 6 caracteres candidatos
        c = list(texto[:6])
        for i in range(3):
            c[i] = _DIG_A_LETRA.get(c[i], c[i])
        for i in range(3, 5):
            c[i] = _LETRA_A_DIG.get(c[i], c[i])
        resultado = "".join(c)
        return resultado if self.PATRON_PLACA.match(resultado) else None

    def _extraer_placa(self, texto: str) -> Optional[str]:
        """Busca patrón de placa en texto; si no hay match directo, intenta corregir."""
        limpio = re.sub(r"[^A-Z0-9]", "", texto.upper())
        # Intento directo
        m = self.PATRON_PLACA.search(limpio)
        if m:
            return m.group(0)
        # Intento con corrección posicional en cada ventana de 6 chars
        for i in range(len(limpio) - 5):
            corr = self._corregir_placa(limpio[i:i+6])
            if corr:
                return corr
        return None

    # ── OCR multi-config con votación ─────────────────────────────

    def _leer_region(self, region: np.ndarray) -> Tuple[Optional[str], str, float]:
        """
        Lee la placa con múltiples preprocesamientos + configs Tesseract.
        Vota carácter a carácter si hay múltiples lecturas válidas.
        Retorna (placa, texto_raw, confianza).
        """
        gris = self._a_gris(region)
        lecturas: List[str] = []      # placas candidatas (6 chars c/u)
        texto_raw_best = ""

        # Intentar primero solo con el 65% superior (evita "MEDELLIN", "CALI", etc.)
        h = gris.shape[0]
        crops = [gris[:max(1, int(h * 0.65)), :], gris]

        for crop in crops:
            for proc in self._preprocesamientos(crop):
                pil = Image.fromarray(proc)
                for cfg in self.TESS_CONFIGS:
                    try:
                        raw = pytesseract.image_to_string(pil, config=cfg)
                        placa = self._extraer_placa(raw)
                        limpio = re.sub(r"[^A-Z0-9]", "", raw.upper())
                        if placa:
                            lecturas.append(placa)
                            if not texto_raw_best:
                                texto_raw_best = limpio
                    except Exception:
                        continue
            if lecturas:
                break  # con el crop superior ya hay resultados, no bajar

        if not lecturas:
            # texto raw de debug aunque no haya placa
            try:
                cfg0 = self.TESS_CONFIGS[0]
                raw = pytesseract.image_to_string(
                    Image.fromarray(self._escalar(gris)), config=cfg0)
                texto_raw_best = re.sub(r"[^A-Z0-9]", "", raw.upper())
            except Exception:
                pass
            return None, texto_raw_best, 0.0

        # Votación carácter a carácter
        placa_votada = self._votar(lecturas)
        # Confianza basada en porcentaje de votos, con mínimo 0.7 si el patrón es exacto
        voto_pct = lecturas.count(placa_votada) / len(lecturas)
        confianza = max(0.70, voto_pct)  # patrón válido = al menos 0.70 de confianza

        return placa_votada, texto_raw_best or placa_votada, round(confianza, 3)

    def _votar(self, lecturas: List[str]) -> str:
        """Vota por el carácter más frecuente en cada posición."""
        if not lecturas:
            return ""
        # Primero elegir la placa más repetida
        conteo = Counter(lecturas)
        mas_comun = conteo.most_common(1)[0][0]
        if conteo[mas_comun] > 1:
            return mas_comun
        # Si todas son únicas, votar por posición
        resultado = []
        for i in range(6):
            chars = [p[i] for p in lecturas if len(p) > i]
            if chars:
                resultado.append(Counter(chars).most_common(1)[0][0])
            else:
                resultado.append(mas_comun[i] if len(mas_comun) > i else "0")
        return "".join(resultado)

    # ── Método principal ──────────────────────────────────────────

    def procesar_imagen_bytes(self, imagen_bytes: bytes) -> dict:
        nparr = np.frombuffer(imagen_bytes, np.uint8)
        imagen = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if imagen is None:
            return {"placa_detectada": None, "confianza": 0.0,
                    "error": "No se pudo decodificar la imagen"}

        # Intentar detectar región en orden de especificidad
        region, metodo = None, "imagen_completa"
        for fn, nombre in [
            (self._region_por_color_amarillo, "color_amarillo"),
            (self._region_por_color_blanco,   "color_blanco"),
            (self._region_por_contornos,       "contornos"),
        ]:
            r = fn(imagen)
            if r is not None:
                region, metodo = r, nombre
                break
        if region is None:
            region = imagen

        placa, texto_raw, confianza = self._leer_region(region)

        # Fallback: si la región específica falló, probar imagen completa
        if placa is None and metodo != "imagen_completa":
            placa_f, texto_f, conf_f = self._leer_region(imagen)
            if placa_f:
                placa, texto_raw, confianza = placa_f, texto_f, conf_f
                metodo = "imagen_completa_fallback"

        # Imagen debug en base64
        debug = self._a_gris(region)
        _, buf = cv2.imencode(".jpg", debug)
        img_b64 = base64.b64encode(buf).decode()

        return {
            "placa_detectada":  placa,
            "texto_raw":        texto_raw,
            "confianza":        confianza,
            "imagen_procesada": img_b64,
            "region_detectada": metodo != "imagen_completa",
            "metodo":           metodo,
        }

    def procesar_imagen_base64(self, imagen_b64: str) -> dict:
        return self.procesar_imagen_bytes(base64.b64decode(imagen_b64))


# Singleton
ocr_service = OCRService()
