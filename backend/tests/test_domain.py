import pytest
from app.domain import (
    PredictionContractError,
    classification_from_status,
    format_image_number,
    predictions_to_detection_records,
    summarize_predictions,
)


def prediction(
    class_name: str, confidence: float, *, width: float = 30.5, height: float = 40.2
) -> dict:
    return {
        "class": class_name,
        "confidence": confidence,
        "x": 10.4,
        "y": 20.6,
        "width": width,
        "height": height,
    }


def test_dominant_by_area_wins_even_with_lower_confidence() -> None:
    summary = summarize_predictions(
        [
            prediction("mato_medio", 0.98, width=10, height=10),
            prediction("mato_longo", 0.72, width=100, height=100),
        ]
    )

    assert summary.classificacao == "alta"
    assert summary.confianca == pytest.approx(0.72)
    assert summary.database_status == "URGENTE"


def test_small_patch_of_taller_grass_does_not_dominate() -> None:
    """Uma imagem majoritariamente de mato_curto com um canto pequeno de
    mato_longo não deve escalar a severidade — a classificação segue a
    classe com maior área total, não a de maior altura presente."""
    summary = summarize_predictions(
        [
            prediction("mato_curto", 0.81, width=200, height=200),
            prediction("mato_longo", 0.99, width=5, height=5),
        ]
    )

    assert summary.classificacao == "baixa"
    assert summary.confianca == pytest.approx(0.81)


def test_medium_wins_when_it_has_more_area_than_short() -> None:
    summary = summarize_predictions(
        [
            prediction("mato_curto", 0.99, width=10, height=10),
            prediction("mato_medio", 0.81, width=50, height=50),
        ]
    )

    assert summary.classificacao == "media"
    assert summary.confianca == pytest.approx(0.81)
    assert summary.database_status == "ATENÇÃO"


def test_low_uses_highest_available_confidence() -> None:
    summary = summarize_predictions(
        [prediction("vegetacao", 0.61), prediction("mato_curto", 0.91)]
    )

    assert summary.classificacao == "baixa"
    assert summary.confianca == pytest.approx(0.91)
    assert summary.database_status == "OK"


def test_empty_predictions_are_low_with_zero_confidence() -> None:
    summary = summarize_predictions([])

    assert summary.classificacao == "baixa"
    assert summary.confianca == 0.0


def test_background_class_is_ignored_for_severity() -> None:
    summary = summarize_predictions(
        [prediction("fundo", 0.99), prediction("mato_curto", 0.4)]
    )

    assert summary.classificacao == "baixa"
    assert summary.confianca == pytest.approx(0.4)


def test_detection_records_preserve_contract_and_round_coordinates() -> None:
    records = predictions_to_detection_records([prediction("mato_longo", 0.8)])

    assert records[0].class_name == "mato_longo"
    assert records[0].confidence == pytest.approx(0.8)
    assert (records[0].x, records[0].y, records[0].width, records[0].height) == (
        10,
        21,
        30,
        40,
    )


def test_detection_records_drop_background_class() -> None:
    records = predictions_to_detection_records(
        [prediction("fundo", 0.99), prediction("mato_curto", 0.4)]
    )

    assert [record.class_name for record in records] == ["mato_curto"]


@pytest.mark.parametrize("missing_field", ["x", "y", "width", "height"])
def test_detection_contract_rejects_missing_geometry(missing_field: str) -> None:
    item = prediction("mato_longo", 0.8)
    item.pop(missing_field)

    with pytest.raises(PredictionContractError):
        predictions_to_detection_records([item])


def test_public_identifier_and_status_mapping() -> None:
    assert format_image_number(1) == "IMG-000001"
    assert format_image_number(1234567) == "IMG-1234567"
    assert classification_from_status("OK") == "baixa"
    assert classification_from_status("ATENÇÃO") == "media"
    assert classification_from_status("URGENTE") == "alta"
