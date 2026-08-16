import asyncio
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from uuid import uuid4

from .config import Settings

PROTOCOL_PREFIX = "MOTIVA_RESULT\t"


class ModelGatewayError(RuntimeError):
    """Base error for the isolated model worker."""


class ModelGatewayTimeoutError(ModelGatewayError):
    pass


class ModelGatewayConfigurationError(ModelGatewayError):
    pass


class ModelGatewayUpstreamError(ModelGatewayError):
    pass


class ModelGatewayUnavailableError(ModelGatewayError):
    pass


@dataclass(frozen=True)
class ModelSegmentationResult:
    raw_predictions: list[dict[str, Any]]


class ModelWorkerClient:
    def __init__(self, settings: Settings) -> None:
        self._python_executable = settings.resolved_model_python_executable
        self._timeout = settings.model_worker_timeout_seconds
        self._worker_path = Path(__file__).resolve().parent.parent / "model_worker.py"
        self._process: asyncio.subprocess.Process | None = None
        self._lock = asyncio.Lock()

    async def close(self) -> None:
        if self._process is None:
            return
        if self._process.returncode is None:
            self._process.terminate()
            try:
                await asyncio.wait_for(self._process.wait(), timeout=5)
            except TimeoutError:
                self._process.kill()
                await self._process.wait()
        self._process = None

    async def segment(self, image_base64: str) -> ModelSegmentationResult:
        async with self._lock:
            process = await self._ensure_started()
            request_id = str(uuid4())
            request = json.dumps(
                {"request_id": request_id, "image": image_base64},
                ensure_ascii=True,
                separators=(",", ":"),
            )
            assert process.stdin is not None
            process.stdin.write((request + "\n").encode("utf-8"))
            await process.stdin.drain()

            try:
                response = await asyncio.wait_for(
                    self._read_response(process, request_id), timeout=self._timeout
                )
            except TimeoutError as exc:
                await self.close()
                raise ModelGatewayTimeoutError("Worker do modelo excedeu o tempo limite") from exc

            if response.get("ok") is True:
                predictions = response.get("raw_predictions")
                if not isinstance(predictions, list) or not all(
                    isinstance(item, dict) for item in predictions
                ):
                    raise ModelGatewayUnavailableError("Worker devolveu predições inválidas")
                return ModelSegmentationResult(raw_predictions=predictions)

            error_type = response.get("error_type")
            if error_type == "timeout":
                raise ModelGatewayTimeoutError("Roboflow não respondeu a tempo")
            if error_type == "configuration":
                raise ModelGatewayConfigurationError("Configuração do modelo ausente")
            if error_type == "upstream":
                raise ModelGatewayUpstreamError("Falha ao processar a imagem no Roboflow")
            raise ModelGatewayUnavailableError("Worker do modelo falhou")

    async def _ensure_started(self) -> asyncio.subprocess.Process:
        if self._process is not None and self._process.returncode is None:
            return self._process
        if not self._python_executable.is_file():
            raise ModelGatewayConfigurationError(
                "Ambiente Python do modelo não encontrado em .venv-model"
            )
        if not self._worker_path.is_file():
            raise ModelGatewayConfigurationError("Executável do worker do modelo ausente")

        self._process = await asyncio.create_subprocess_exec(
            str(self._python_executable),
            str(self._worker_path),
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL,
            cwd=str(self._worker_path.parent),
            limit=16 * 1024 * 1024,
        )
        return self._process

    async def _read_response(
        self, process: asyncio.subprocess.Process, request_id: str
    ) -> dict[str, Any]:
        assert process.stdout is not None
        while True:
            line = await process.stdout.readline()
            if not line:
                await self.close()
                raise ModelGatewayUnavailableError("Worker do modelo foi encerrado inesperadamente")
            text = line.decode("utf-8", errors="replace").rstrip("\r\n")
            if not text.startswith(PROTOCOL_PREFIX):
                continue
            try:
                response = json.loads(text.removeprefix(PROTOCOL_PREFIX))
            except json.JSONDecodeError as exc:
                raise ModelGatewayUnavailableError("Resposta inválida do worker do modelo") from exc
            if response.get("request_id") == request_id:
                return response
