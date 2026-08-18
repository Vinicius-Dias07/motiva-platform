from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Protocol

CLASSIFICATION_TO_STATUS = {
    "baixa": "OK",
    "media": "ATENÇÃO",
    "alta": "URGENTE",
}
STATUS_TO_CLASSIFICATION = {
    status: classification for classification, status in CLASSIFICATION_TO_STATUS.items()
}

# Nomes de classe confirmados numa inferência real contra o workflow
# grass-seg-dv3ek (modelo grass-seg-dv3ek-2-yolo26n-sem-t1): "fundo" é
# background do modelo de segmentação semântica, não vegetação — precisa
# ser descartado antes de calcular severidade ou persistir detecções.
BACKGROUND_CLASS_NAME = "fundo"

# Uma mesma imagem costuma trazer várias classes de altura de mato juntas
# (ex.: uma faixa de mato_curto e um canto isolado de mato_longo) — por
# isso a severidade é decidida pela classe com maior área total na
# imagem, não pela mera presença de uma classe.
GRASS_CLASS_TO_CLASSIFICATION = {
    "mato_curto": "baixa",
    "mato_medio": "media",
    "mato_longo": "alta",
}


class PredictionContractError(ValueError):
    """The model returned a prediction that cannot fit the existing DB contract."""


class DatabaseUnavailableError(RuntimeError):
    """The configured PostgreSQL database could not complete the operation."""


@dataclass(frozen=True)
class AnalysisSummary:
    classificacao: str
    confianca: float

    @property
    def database_status(self) -> str:
        return CLASSIFICATION_TO_STATUS[self.classificacao]


@dataclass(frozen=True)
class DetectionRecord:
    class_name: str
    confidence: float
    x: int
    y: int
    width: int
    height: int


@dataclass(frozen=True)
class StoredAlert:
    inspection_id: int
    latitude: float
    longitude: float
    status: str
    confidence: float
    created_at: datetime


class InspectionRepositoryProtocol(Protocol):
    async def create_inspection(
        self,
        *,
        latitude: float,
        longitude: float,
        status: str,
        confidence: float,
        detections: Sequence[DetectionRecord],
    ) -> int: ...

    async def list_alerts(self) -> list[StoredAlert]: ...


def _prediction_class(prediction: dict[str, Any]) -> str:
    class_name = prediction.get("class") or prediction.get("class_name")
    if not isinstance(class_name, str) or not class_name.strip():
        raise PredictionContractError("Predição sem classe válida")
    return class_name.strip().lower()


def _prediction_confidence(prediction: dict[str, Any]) -> float:
    value = prediction.get("confidence")
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise PredictionContractError("Predição sem confiança numérica")
    confidence = float(value)
    if not 0.0 <= confidence <= 1.0:
        raise PredictionContractError("Confiança da predição fora do intervalo 0..1")
    return confidence


def _prediction_area(prediction: dict[str, Any]) -> float:
    width = prediction.get("width")
    height = prediction.get("height")
    if (
        isinstance(width, bool)
        or isinstance(height, bool)
        or not isinstance(width, (int, float))
        or not isinstance(height, (int, float))
    ):
        raise PredictionContractError("Predição sem largura/altura numérica para calcular área")
    return float(width) * float(height)


def summarize_predictions(predictions: Sequence[dict[str, Any]]) -> AnalysisSummary:
    parsed = [
        (name, _prediction_confidence(item), item)
        for item in predictions
        if (name := _prediction_class(item)) != BACKGROUND_CLASS_NAME
    ]

    area_by_class: dict[str, float] = {}
    best_confidence_by_class: dict[str, float] = {}
    for name, confidence, item in parsed:
        if name not in GRASS_CLASS_TO_CLASSIFICATION:
            continue
        area_by_class[name] = area_by_class.get(name, 0.0) + _prediction_area(item)
        best_confidence_by_class[name] = max(best_confidence_by_class.get(name, 0.0), confidence)

    if area_by_class:
        dominant_class = max(area_by_class, key=area_by_class.get)
        return AnalysisSummary(
            GRASS_CLASS_TO_CLASSIFICATION[dominant_class],
            best_confidence_by_class[dominant_class],
        )

    return AnalysisSummary(
        "baixa", max((confidence for _, confidence, _ in parsed), default=0.0)
    )


def predictions_to_detection_records(
    predictions: Sequence[dict[str, Any]],
) -> list[DetectionRecord]:
    records: list[DetectionRecord] = []
    for prediction in predictions:
        class_name = _prediction_class(prediction)
        if class_name == BACKGROUND_CLASS_NAME:
            continue
        confidence = _prediction_confidence(prediction)

        numeric_fields: dict[str, int] = {}
        for field in ("x", "y", "width", "height"):
            value = prediction.get(field)
            if isinstance(value, bool) or not isinstance(value, (int, float)):
                raise PredictionContractError(f"Predição sem campo numérico obrigatório: {field}")
            numeric_fields[field] = round(float(value))

        if numeric_fields["width"] < 0 or numeric_fields["height"] < 0:
            raise PredictionContractError("Dimensões da detecção não podem ser negativas")

        records.append(
            DetectionRecord(
                class_name=class_name,
                confidence=confidence,
                x=numeric_fields["x"],
                y=numeric_fields["y"],
                width=numeric_fields["width"],
                height=numeric_fields["height"],
            )
        )
    return records


def format_image_number(inspection_id: int) -> str:
    return f"IMG-{inspection_id:06d}"


def classification_from_status(status: str) -> str:
    try:
        return STATUS_TO_CLASSIFICATION[status]
    except KeyError as exc:
        raise PredictionContractError(f"Status desconhecido no banco: {status}") from exc
