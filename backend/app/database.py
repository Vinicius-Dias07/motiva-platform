from collections.abc import Sequence

import psycopg
from psycopg_pool import AsyncConnectionPool, PoolTimeout

from .config import Settings
from .domain import (
    DatabaseUnavailableError,
    DetectionRecord,
    StoredAlert,
)


def create_pool(settings: Settings) -> AsyncConnectionPool:
    if not settings.database_url:
        raise ValueError("DATABASE_URL não configurada")
    return AsyncConnectionPool(
        conninfo=settings.database_url,
        min_size=settings.database_pool_min_size,
        max_size=settings.database_pool_max_size,
        timeout=settings.database_pool_timeout_seconds,
        open=False,
        kwargs={"autocommit": False},
    )


class InspectionRepository:
    def __init__(self, pool: AsyncConnectionPool) -> None:
        self._pool = pool

    async def create_inspection(
        self,
        *,
        latitude: float,
        longitude: float,
        status: str,
        confidence: float,
        detections: Sequence[DetectionRecord],
    ) -> int:
        try:
            async with self._pool.connection() as connection, connection.transaction():
                cursor = await connection.execute(
                    """
                        INSERT INTO inspections (latitude, longitude, status, confidence)
                        VALUES (%s, %s, %s, %s)
                        RETURNING id
                        """,
                    (latitude, longitude, status, confidence),
                )
                row = await cursor.fetchone()
                if row is None:
                    raise DatabaseUnavailableError(
                        "O PostgreSQL não retornou o ID da inspeção criada"
                    )
                inspection_id = int(row[0])

                if detections:
                    async with connection.cursor() as detection_cursor:
                        await detection_cursor.executemany(
                            """
                                INSERT INTO detections (
                                    inspection_id,
                                    class_name,
                                    confidence,
                                    x,
                                    y,
                                    width,
                                    height
                                )
                                VALUES (%s, %s, %s, %s, %s, %s, %s)
                                """,
                            [
                                (
                                    inspection_id,
                                    detection.class_name,
                                    detection.confidence,
                                    detection.x,
                                    detection.y,
                                    detection.width,
                                    detection.height,
                                )
                                for detection in detections
                            ],
                        )
                return inspection_id
        except DatabaseUnavailableError:
            raise
        except (psycopg.Error, PoolTimeout, RuntimeError) as exc:
            raise DatabaseUnavailableError("Falha ao gravar a inspeção no PostgreSQL") from exc

    async def list_alerts(self) -> list[StoredAlert]:
        try:
            async with self._pool.connection() as connection:
                cursor = await connection.execute(
                    """
                    SELECT id, latitude, longitude, status, confidence, created_at
                    FROM inspections
                    ORDER BY created_at DESC, id DESC
                    """
                )
                rows = await cursor.fetchall()
                return [
                    StoredAlert(
                        inspection_id=int(row[0]),
                        latitude=float(row[1]),
                        longitude=float(row[2]),
                        status=str(row[3]),
                        confidence=float(row[4]),
                        created_at=row[5],
                    )
                    for row in rows
                ]
        except (psycopg.Error, PoolTimeout, RuntimeError) as exc:
            raise DatabaseUnavailableError("Falha ao consultar alertas no PostgreSQL") from exc


async def ping_database(pool: AsyncConnectionPool) -> None:
    try:
        async with pool.connection() as connection:
            await connection.execute("SELECT 1")
    except (psycopg.Error, PoolTimeout, RuntimeError) as exc:
        raise DatabaseUnavailableError("PostgreSQL indisponível") from exc
