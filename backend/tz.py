"""
tz.py — Utilidad de zona horaria para Colombia (America/Bogota, UTC-5)

Uso:
    from tz import now_col
    ahora = now_col()   # datetime naive en hora de Colombia
"""
from zoneinfo import ZoneInfo
from datetime import datetime

BOGOTA = ZoneInfo("America/Bogota")


def now_col() -> datetime:
    """
    Retorna la hora actual en Colombia (America/Bogota, UTC-5) como
    datetime *naive* (sin tzinfo), listo para almacenar en la base de datos.
    """
    return datetime.now(BOGOTA).replace(tzinfo=None)
