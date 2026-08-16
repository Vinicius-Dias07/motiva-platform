import base64
import io
from dataclasses import dataclass
from typing import Any, Dict, List

from . import roboflow_client
from .mask_reconstructor import build_mask, extract_predictions
from .roboflow_client import DEFAULT_TIMEOUT_SECONDS


@dataclass(frozen=True)
class SegmentationResult:
    mask_png_bytes: bytes
    mask_base64: str
    width: int
    height: int
    predictions_count: int
    raw_predictions: List[Dict[str, Any]]


async def segment_vegetation(
    image_base64: str,
    *,
    timeout: float = DEFAULT_TIMEOUT_SECONDS,
) -> SegmentationResult:
    """Orquestra a chamada ao Roboflow e a reconstrução da máscara de segmentação.

    Deixa propagar RoboflowCallError/RoboflowTimeoutError/MaskReconstructionError —
    quem chama decide como isso vira uma resposta de API.
    """
    workflow_result = await roboflow_client.run_workflow(image_base64, timeout=timeout)
    predictions, width, height = extract_predictions(workflow_result, image_base64)
    mask_image = build_mask(predictions, width=width, height=height)

    buffer = io.BytesIO()
    mask_image.save(buffer, format="PNG")
    mask_png_bytes = buffer.getvalue()
    mask_base64 = base64.b64encode(mask_png_bytes).decode("ascii")

    return SegmentationResult(
        mask_png_bytes=mask_png_bytes,
        mask_base64=mask_base64,
        width=width,
        height=height,
        predictions_count=len(predictions),
        raw_predictions=predictions,
    )
