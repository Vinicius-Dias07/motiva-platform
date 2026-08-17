import pytest
from app.domain import (
    PredictionContractError,
    classification_from_status,
    format_image_number,
    predictions_to_detection_records,
    summarize_predictions,
)


def prediction(class_name: str, confidence: float) -> dict:
    return {
        "class": class_name,
        "confidence": confidence,
        "x": 10.4,
        "y": 20.6,
        "width": 30.5,
        "height": 40.2,
    }


def test_highest_severity_wins_even_with_lower_confidence() -> None:
    summary = summarize_predictions(
        [prediction("grass_medium", 0.98), prediction("grass_tall", 0.72)]
    )

    assert summary.classificacao == "alta"
    assert summary.confianca == pytest.approx(0.72)
    assert summary.database_status == "URGENTE"


def test_medium_wins_when_tall_is_absent() -> None:
    summary = summarize_predictions(
        [prediction("grass_short", 0.99), prediction("grass_medium", 0.81)]
    )

    assert summary.classificacao == "media"
    assert summary.confianca == pytest.approx(0.81)
    assert summary.database_status == "ATENÇÃO"


def test_low_uses_highest_available_confidence() -> None:
    summary = summarize_predictions(
        [prediction("non_grass_veg", 0.61), prediction("grass_short", 0.91)]
    )

    assert summary.classificacao == "baixa"
    assert summary.confianca == pytest.approx(0.91)
    assert summary.database_status == "OK"


def test_empty_predictions_are_low_with_zero_confidence() -> None:
    summary = summarize_predictions([])

    assert summary.classificacao == "baixa"
    assert summary.confianca == 0.0


def test_detection_records_preserve_contract_and_round_coordinates() -> None:
    records = predictions_to_detection_records([prediction("grass_tall", 0.8)])

    assert records[0].class_name == "grass_tall"
    assert records[0].confidence == pytest.approx(0.8)
    assert (records[0].x, records[0].y, records[0].width, records[0].height) == (
        10,
        21,
        30,
        40,
    )


@pytest.mark.parametrize("missing_field", ["x", "y", "width", "height"])
def test_detection_contract_rejects_missing_geometry(missing_field: str) -> None:
    item = prediction("grass_tall", 0.8)
    item.pop(missing_field)

    with pytest.raises(PredictionContractError):
        predictions_to_detection_records([item])


def test_public_identifier_and_status_mapping() -> None:
    assert format_image_number(1) == "IMG-000001"
    assert format_image_number(1234567) == "IMG-1234567"
    assert classification_from_status("OK") == "baixa"
    assert classification_from_status("ATENÇÃO") == "media"
    assert classification_from_status("URGENTE") == "alta"
