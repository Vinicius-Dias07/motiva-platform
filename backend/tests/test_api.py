from collections.abc import Sequence
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from types import SimpleNamespace

import pytest
from app.config import Settings
from app.domain import DatabaseUnavailableError, DetectionRecord, StoredAlert
from app.main import create_app, get_repository, get_segmenter
from app.model_gateway import ModelGatewayTimeoutError
from httpx import ASGITransport, AsyncClient


@asynccontextmanager
async def api_client(application):
    async with application.router.lifespan_context(application):
        transport = ASGITransport(app=application)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            yield client


class FakeRepository:
    def __init__(self) -> None:
        self.created: dict | None = None
        self.alerts: list[StoredAlert] = []

    async def create_inspection(
        self,
        *,
        latitude: float,
        longitude: float,
        status: str,
        confidence: float,
        detections: Sequence[DetectionRecord],
    ) -> int:
        self.created = {
            "latitude": latitude,
            "longitude": longitude,
            "status": status,
            "confidence": confidence,
            "detections": list(detections),
        }
        return 7

    async def list_alerts(self) -> list[StoredAlert]:
        return self.alerts


def model_prediction(class_name: str, confidence: float) -> dict:
    return {
        "class": class_name,
        "confidence": confidence,
        "x": 100,
        "y": 80,
        "width": 40,
        "height": 30,
    }


@pytest.fixture
def repository() -> FakeRepository:
    return FakeRepository()


@pytest.fixture(autouse=True)
def isolated_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    settings = Settings(_env_file=None)
    monkeypatch.setattr("app.main.get_settings", lambda: settings)


@pytest.fixture
def application(repository: FakeRepository):
    app = create_app()

    async def fake_segmenter(_: str):
        return SimpleNamespace(
            raw_predictions=[
                model_prediction("grass_medium", 0.97),
                model_prediction("grass_tall", 0.88),
            ]
        )

    app.dependency_overrides[get_repository] = lambda: repository
    app.dependency_overrides[get_segmenter] = lambda: fake_segmenter
    return app


async def test_create_inspection_contract_and_persistence(
    application, repository: FakeRepository
) -> None:
    async with api_client(application) as client:
        response = await client.post(
            "/api/v1/inspections",
            json={
                "image": "data:image/jpeg;base64,aW1hZ2U=",
                "lat": -23.55,
                "lon": -46.82,
            },
        )

    assert response.status_code == 201
    assert response.json() == {
        "img_num": "IMG-000007",
        "lat": -23.55,
        "lon": -46.82,
        "classificacao": "alta",
        "confianca": 0.88,
        "created_at": None,
    }
    assert repository.created is not None
    assert repository.created["status"] == "URGENTE"
    assert repository.created["confidence"] == pytest.approx(0.88)
    assert len(repository.created["detections"]) == 2


async def test_list_alerts_maps_database_status(application, repository: FakeRepository) -> None:
    created_at_9 = datetime(2026, 1, 5, 12, 30, tzinfo=UTC)
    created_at_8 = datetime(2026, 1, 5, 12, 0, tzinfo=UTC)
    repository.alerts = [
        StoredAlert(
            inspection_id=9,
            latitude=-23.5,
            longitude=-46.7,
            status="ATENÇÃO",
            confidence=0.75,
            created_at=created_at_9,
        ),
        StoredAlert(
            inspection_id=8,
            latitude=-23.6,
            longitude=-46.8,
            status="OK",
            confidence=0.42,
            created_at=created_at_8,
        ),
    ]

    async with api_client(application) as client:
        response = await client.get("/api/v1/alerts")

    assert response.status_code == 200
    assert response.json() == [
        {
            "img_num": "IMG-000009",
            "lat": -23.5,
            "lon": -46.7,
            "classificacao": "media",
            "confianca": 0.75,
            "created_at": "2026-01-05T12:30:00Z",
        },
        {
            "img_num": "IMG-000008",
            "lat": -23.6,
            "lon": -46.8,
            "classificacao": "baixa",
            "confianca": 0.42,
            "created_at": "2026-01-05T12:00:00Z",
        },
    ]


async def test_invalid_base64_is_rejected_before_model(application) -> None:
    async with api_client(application) as client:
        response = await client.post(
            "/api/v1/inspections",
            json={"image": "not-base64!", "lat": -23.55, "lon": -46.82},
        )

    assert response.status_code == 422
    assert response.json()["detail"] == "Imagem não contém base64 válido"


async def test_coordinate_validation_uses_database_limits(application) -> None:
    async with api_client(application) as client:
        response = await client.post(
            "/api/v1/inspections",
            json={"image": "aW1hZ2U=", "lat": -91, "lon": -46.82},
        )

    assert response.status_code == 422


async def test_model_timeout_becomes_gateway_timeout(application) -> None:
    async def timeout_segmenter(_: str):
        raise ModelGatewayTimeoutError("timeout")

    application.dependency_overrides[get_segmenter] = lambda: timeout_segmenter
    async with api_client(application) as client:
        response = await client.post(
            "/api/v1/inspections",
            json={"image": "aW1hZ2U=", "lat": -23.55, "lon": -46.82},
        )

    assert response.status_code == 504


async def test_database_failure_is_service_unavailable(
    application, repository: FakeRepository
) -> None:
    async def unavailable(**_: object) -> int:
        raise DatabaseUnavailableError("offline")

    repository.create_inspection = unavailable  # type: ignore[method-assign]
    async with api_client(application) as client:
        response = await client.post(
            "/api/v1/inspections",
            json={"image": "aW1hZ2U=", "lat": -23.55, "lon": -46.82},
        )

    assert response.status_code == 503


async def test_health_reports_missing_database_without_exposing_configuration() -> None:
    app = create_app()
    async with api_client(app) as client:
        response = await client.get("/health")

    assert response.status_code == 503
    assert response.json() == {"status": "degraded", "database": "not_configured"}
