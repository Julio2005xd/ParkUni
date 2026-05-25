"""
services/cobro_service.py
Servicio de cálculo de tarifas por tiempo de permanencia
"""
from datetime import datetime
from decimal import Decimal
from tz import now_col


class CobroService:
    """
    Calcula el cobro según el tiempo de permanencia del vehículo.
    Tarifas por defecto en COP (pesos colombianos).
    """

    TARIFA_MINUTO: Decimal = Decimal("100.00")   # $100 COP/min
    TARIFA_HORA:   Decimal = Decimal("3000.00")  # $3,000 COP/hora
    TARIFA_DIA:    Decimal = Decimal("30000.00") # $30,000 COP/día máximo

    def calcular_cobro(
        self,
        entrada: datetime,
        salida: datetime,
        tipo_usuario: str = "visitante",
        tarifa_minuto: float | None = None,
    ) -> dict:
        """
        Calcula el cobro basado en tiempo de permanencia.

        - Usuarios registrados con mensualidad activa: $0
        - Visitantes y usuarios sin mensualidad: tarifa por minuto
        """
        if tipo_usuario == "registrado":
            # La validación de mensualidad se hace antes del ingreso;
            # si llegó aquí, tiene derecho a tarifa cero.
            return {
                "minutos":      0,
                "valor":        Decimal("0.00"),
                "descripcion":  "Usuario con mensualidad activa",
                "tipo_cobro":   "mensualidad",
            }

        # Calcular diferencia en minutos
        delta = salida - entrada
        minutos = max(int(delta.total_seconds() / 60), 1)

        tarifa = Decimal(str(tarifa_minuto)) if tarifa_minuto else self.TARIFA_MINUTO

        # Cobro por minutos (con tope diario)
        valor_calculado = tarifa * Decimal(str(minutos))
        valor_final = min(valor_calculado, self.TARIFA_DIA)

        # Descripción amigable
        horas = minutos // 60
        mins  = minutos % 60
        if horas > 0:
            tiempo_str = f"{horas}h {mins}min"
        else:
            tiempo_str = f"{mins} minutos"

        return {
            "minutos":     minutos,
            "valor":       valor_final.quantize(Decimal("0.01")),
            "descripcion": f"Tiempo de permanencia: {tiempo_str}",
            "tipo_cobro":  "por_tiempo",
        }

    def calcular_cobro_actual(
        self,
        entrada: datetime,
        tipo_usuario: str = "visitante",
    ) -> dict:
        """Calcula el cobro hasta el momento actual."""
        return self.calcular_cobro(entrada, now_col(), tipo_usuario)


cobro_service = CobroService()
