from pydantic import BaseModel

class Alert(BaseModel):
    level: str
    symbol: str | None = None
    message: str
