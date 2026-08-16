from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_ENV_PATH = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    database_url: str | None = None
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    database_pool_min_size: int = 1
    database_pool_max_size: int = 5
    database_pool_timeout_seconds: float = 5.0
    model_python_executable: str | None = None
    model_worker_timeout_seconds: float = 40.0

    model_config = SettingsConfigDict(
        env_file=_ENV_PATH,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def parsed_cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def resolved_model_python_executable(self) -> Path:
        repository_root = Path(__file__).resolve().parents[2]
        if self.model_python_executable:
            configured_path = Path(self.model_python_executable)
            if configured_path.is_absolute():
                return configured_path
            return repository_root / configured_path
        return repository_root / ".venv-model" / "Scripts" / "python.exe"


@lru_cache
def get_settings() -> Settings:
    return Settings()
