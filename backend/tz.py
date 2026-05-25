from zoneinfo import ZoneInfo
from datetime import datetime

BOGOTA = ZoneInfo("America/Bogota")

def now_col() -> datetime:
    return datetime.now(BOGOTA).replace(tzinfo=None)
