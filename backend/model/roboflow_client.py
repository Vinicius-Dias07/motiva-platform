import asyncio
from typing import Any, Dict, List, Optional

from inference_sdk import InferenceHTTPClient
from inference_sdk.http.errors import HTTPClientError

from .config import Settings, get_settings
from .exceptions import RoboflowCallError, RoboflowTimeoutError

DEFAULT_TIMEOUT_SECONDS = 30.0


def _call_run_workflow_sync(settings: Settings, image_base64: str) -> List[Dict[str, Any]]:
    client = InferenceHTTPClient(api_url=settings.api_url, api_key=settings.api_key)
    return client.run_workflow(
        workspace_name=settings.workspace_name,
        workflow_id=settings.workflow_id,
        images={"image": image_base64},
        use_cache=True,
    )


async def run_workflow(
    image_base64: str,
    *,
    settings: Optional[Settings] = None,
    timeout: float = DEFAULT_TIMEOUT_SECONDS,
) -> List[Dict[str, Any]]:
    """Chama o workflow do Roboflow de forma assíncrona (sem travar o event loop).

    A chamada bloqueante roda em thread separada (asyncio.to_thread); o
    asyncio.wait_for só limita quanto tempo o caller espera — não cancela a
    thread em si, que segue rodando em background até o SDK responder.
    """
    resolved_settings = settings or get_settings()
    try:
        return await asyncio.wait_for(
            asyncio.to_thread(_call_run_workflow_sync, resolved_settings, image_base64),
            timeout=timeout,
        )
    except asyncio.TimeoutError as exc:
        raise RoboflowTimeoutError(
            f"Chamada ao Roboflow excedeu o timeout de {timeout}s",
            cause=exc,
        ) from exc
    except HTTPClientError as exc:
        status_code = getattr(exc, "status_code", None)
        raise RoboflowCallError(
            f"Falha na chamada ao Roboflow: {exc}",
            status_code=status_code,
            cause=exc,
        ) from exc
