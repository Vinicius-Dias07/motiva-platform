import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

from .exceptions import MissingConfigError

_ENV_PATH = Path(__file__).resolve().parent / ".env"
_DEFAULT_API_URL = "https://serverless.roboflow.com"

load_dotenv(dotenv_path=_ENV_PATH)


@dataclass(frozen=True)
class Settings:
    api_url: str
    api_key: str
    workspace_name: str
    workflow_id: str


def _require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise MissingConfigError(f"Variável de ambiente obrigatória ausente: {name}")
    return value


def get_settings() -> Settings:
    return Settings(
        api_url=os.environ.get("ROBOFLOW_API_URL", _DEFAULT_API_URL),
        api_key=_require_env("ROBOFLOW_API_KEY"),
        workspace_name=_require_env("ROBOFLOW_WORKSPACE_NAME"),
        workflow_id=_require_env("ROBOFLOW_WORKFLOW_ID"),
    )
