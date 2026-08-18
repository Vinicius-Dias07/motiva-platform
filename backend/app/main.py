import base64
import binascii
from collections.abc import Awaitable, Callable
from contextlib import asynccontextmanager
from typing import Annotated, Any

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from psycopg_pool import AsyncConnectionPool

from .config import get_settings
from .database import InspectionRepository, create_pool, ping_database
from .domain import (
    DatabaseUnavailableError,
    InspectionRepositoryProtocol,
    PredictionContractError,
    classification_from_status,
    format_image_number,
    predictions_to_detection_records,
    summarize_predictions,
)
from .model_gateway import (
    ModelGatewayConfigurationError,
    ModelGatewayTimeoutError,
    ModelGatewayUnavailableError,
    ModelGatewayUpstreamError,
    ModelWorkerClient,
)
from .schemas import AlertResponse, HealthResponse, InspectionRequest

Segmenter = Callable[[str], Awaitable[Any]]


def normalize_base64_image(value: str) -> str:
    normalized = value.strip()
    if normalized.lower().startswith("data:"):
        header, separator, payload = normalized.partition(",")
        if not separator or not header.lower().startswith("data:image/") or ";base64" not in header:
            raise ValueError("Data URI de imagem inválida")
        normalized = payload

    try:
        decoded = base64.b64decode(normalized, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("Imagem não contém base64 válido") from exc
    if not decoded:
        raise ValueError("Imagem base64 vazia")
    return normalized


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    pool: AsyncConnectionPool | None = None
    model_gateway = ModelWorkerClient(settings)
    if settings.database_url:
        pool = create_pool(settings)
        await pool.open(wait=False)
    app.state.database_pool = pool
    app.state.model_gateway = model_gateway
    try:
        yield
    finally:
        await model_gateway.close()
        if pool is not None:
            await pool.close()


def get_repository(request: Request) -> InspectionRepositoryProtocol:
    pool: AsyncConnectionPool | None = request.app.state.database_pool
    if pool is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="DATABASE_URL não configurada",
        )
    return InspectionRepository(pool)


def get_segmenter(request: Request) -> Segmenter:
    model_gateway: ModelWorkerClient = request.app.state.model_gateway
    return model_gateway.segment


def create_app() -> FastAPI:
    settings = get_settings()
    application = FastAPI(
        title="Motiva Platform API",
        version="1.0.0",
        lifespan=lifespan,
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.parsed_cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )

    @application.get(
        "/health",
        response_model=HealthResponse,
        responses={503: {"model": HealthResponse}},
    )
    async def health(request: Request) -> HealthResponse | JSONResponse:
        pool: AsyncConnectionPool | None = request.app.state.database_pool
        if pool is None:
            return JSONResponse(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                content={"status": "degraded", "database": "not_configured"},
            )
        try:
            await ping_database(pool)
        except DatabaseUnavailableError:
            return JSONResponse(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                content={"status": "degraded", "database": "unavailable"},
            )
        return HealthResponse(status="ok", database="ok")

    @application.post(
        "/api/v1/inspections",
        response_model=AlertResponse,
        status_code=status.HTTP_201_CREATED,
    )
    async def create_inspection(
        payload: InspectionRequest,
        repository: Annotated[InspectionRepositoryProtocol, Depends(get_repository)],
        segmenter: Annotated[Segmenter, Depends(get_segmenter)],
    ) -> AlertResponse:
        try:
            image_base64 = normalize_base64_image(payload.image)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

        try:
            model_result = await segmenter(image_base64)
        except ModelGatewayTimeoutError as exc:
            raise HTTPException(status_code=504, detail="Roboflow não respondeu a tempo") from exc
        except ModelGatewayUpstreamError as exc:
            raise HTTPException(status_code=502, detail="Falha ao processar a imagem") from exc
        except ModelGatewayConfigurationError as exc:
            raise HTTPException(status_code=500, detail="Configuração do modelo ausente") from exc
        except ModelGatewayUnavailableError as exc:
            raise HTTPException(status_code=502, detail="Worker do modelo indisponível") from exc

        raw_predictions = getattr(model_result, "raw_predictions", None)
        if not isinstance(raw_predictions, list) or not all(
            isinstance(item, dict) for item in raw_predictions
        ):
            raise HTTPException(status_code=502, detail="Resposta inesperada do modelo")

        try:
            summary = summarize_predictions(raw_predictions)
            detections = predictions_to_detection_records(raw_predictions)
        except PredictionContractError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc

        try:
            inspection_id = await repository.create_inspection(
                latitude=payload.lat,
                longitude=payload.lon,
                status=summary.database_status,
                confidence=summary.confianca,
                detections=detections,
            )
        except DatabaseUnavailableError as exc:
            raise HTTPException(status_code=503, detail="PostgreSQL indisponível") from exc

        return AlertResponse(
            img_num=format_image_number(inspection_id),
            lat=payload.lat,
            lon=payload.lon,
            classificacao=summary.classificacao,
            confianca=summary.confianca,
        )

    @application.get("/api/v1/alerts", response_model=list[AlertResponse])
    async def list_alerts(
        repository: Annotated[InspectionRepositoryProtocol, Depends(get_repository)],
    ) -> list[AlertResponse]:
        try:
            alerts = await repository.list_alerts()
            return [
                AlertResponse(
                    img_num=format_image_number(alert.inspection_id),
                    lat=alert.latitude,
                    lon=alert.longitude,
                    classificacao=classification_from_status(alert.status),
                    confianca=alert.confidence,
                    created_at=alert.created_at,
                )
                for alert in alerts
            ]
        except DatabaseUnavailableError as exc:
            raise HTTPException(status_code=503, detail="PostgreSQL indisponível") from exc
        except PredictionContractError as exc:
            raise HTTPException(
                status_code=500, detail="Status inválido armazenado no banco"
            ) from exc

    return application


app = create_app()
