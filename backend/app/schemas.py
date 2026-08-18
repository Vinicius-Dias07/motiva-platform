from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints

Base64Image = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class InspectionRequest(BaseModel):
    image: Base64Image
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)


class AlertResponse(BaseModel):
    img_num: str
    lat: float
    lon: float
    classificacao: str
    confianca: float = Field(ge=0, le=1)
    created_at: datetime | None = None


class HealthResponse(BaseModel):
    status: str
    database: str
