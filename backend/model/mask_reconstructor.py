import base64
import io
from dataclasses import dataclass
from typing import Any, Dict, List, Tuple

import numpy as np
import supervision as sv
from PIL import Image, ImageDraw

from .exceptions import MaskReconstructionError

MIN_POLYGON_POINTS = 3


@dataclass(frozen=True)
class ClassStyle:
    color: Tuple[int, int, int]


# Classes confirmadas rodando uma inferência real contra grass-seg-dv3ek
# (ver backend/model/README.md, seção "Suposições"). "grass_tall" não foi
# observada na imagem de teste, mas é assumida por simetria com
# grass_short/grass_medium.
DEFAULT_CLASS_STYLES: Dict[str, ClassStyle] = {
    "grass_tall": ClassStyle((220, 50, 50)),
    "grass_medium": ClassStyle((230, 180, 40)),
    "grass_short": ClassStyle((60, 170, 80)),
    "non_grass_veg": ClassStyle((60, 120, 200)),
}
FALLBACK_CLASS_COLOR = (140, 140, 140)
MASK_FILL_ALPHA = 140


def _decode_image_size(image_base64: str) -> Tuple[int, int]:
    try:
        raw = base64.b64decode(image_base64)
        with Image.open(io.BytesIO(raw)) as img:
            return img.size
    except Exception as exc:
        raise MaskReconstructionError(
            "Não foi possível decodificar image_base64 para determinar as dimensões da imagem"
        ) from exc


def extract_predictions(
    workflow_result: List[Dict[str, Any]],
    image_base64: str,
) -> Tuple[List[Dict[str, Any]], int, int]:
    if not workflow_result:
        raise MaskReconstructionError("run_workflow retornou uma lista vazia")

    first_item = workflow_result[0]
    if not isinstance(first_item, dict):
        raise MaskReconstructionError(
            f"Item inesperado no retorno do Roboflow: tipo {type(first_item).__name__}"
        )

    predictions_field = first_item.get("predictions")
    if predictions_field is None:
        raise MaskReconstructionError(
            "Chave 'predictions' ausente no retorno do Roboflow. "
            f"Chaves disponíveis: {sorted(first_item.keys())}"
        )

    if isinstance(predictions_field, list):
        predictions = predictions_field
        image_info: Dict[str, Any] = {}
    elif isinstance(predictions_field, dict):
        predictions = predictions_field.get("predictions")
        image_info = predictions_field.get("image") or {}
        if predictions is None:
            raise MaskReconstructionError(
                "Chave 'predictions.predictions' ausente no retorno do Roboflow. "
                f"Chaves disponíveis em 'predictions': {sorted(predictions_field.keys())}"
            )
    else:
        raise MaskReconstructionError(
            f"Formato inesperado para 'predictions': tipo {type(predictions_field).__name__}"
        )

    # Observado em produção: predictions["image"] vem como {"width": None,
    # "height": None} nesse workflow — o fallback abaixo é o caminho real,
    # não só uma proteção teórica.
    width = image_info.get("width")
    height = image_info.get("height")
    if not width or not height:
        width, height = _decode_image_size(image_base64)

    return predictions, int(width), int(height)


def _resolve_class_name(prediction: Dict[str, Any]) -> str:
    class_name = prediction.get("class") or prediction.get("class_name")
    if not class_name:
        raise MaskReconstructionError(
            f"Predição sem chave 'class'/'class_name': {sorted(prediction.keys())}"
        )
    return str(class_name)


def _polygon_to_binary_mask(
    points: List[Dict[str, Any]], *, width: int, height: int
) -> np.ndarray:
    try:
        polygon = [(float(p["x"]), float(p["y"])) for p in points]
    except (KeyError, TypeError, ValueError) as exc:
        raise MaskReconstructionError(f"Pontos de polígono malformados: {points!r}") from exc

    layer = Image.new("1", (width, height), 0)
    ImageDraw.Draw(layer).polygon(polygon, fill=1)
    return np.array(layer, dtype=bool)


def _rle_to_binary_mask(rle_mask: Dict[str, Any], *, width: int, height: int) -> np.ndarray:
    size = rle_mask.get("size")
    counts = rle_mask.get("counts")
    if not size or counts is None:
        raise MaskReconstructionError(f"'rle_mask' malformado: {sorted(rle_mask.keys())}")

    rle_height, rle_width = size
    try:
        mask = sv.rle_to_mask(counts, (rle_width, rle_height))
    except Exception as exc:
        raise MaskReconstructionError(f"Falha ao decodificar rle_mask: {exc}") from exc

    if mask.shape != (height, width):
        raise MaskReconstructionError(
            f"Dimensão do rle_mask {mask.shape} não bate com a imagem ({height}, {width})"
        )
    return mask


def _resolve_binary_mask(
    prediction: Dict[str, Any], *, width: int, height: int
) -> np.ndarray:
    """Predições podem trazer o formato como polígono (`points`) ou como
    máscara RLE (`rle_mask`, formato confirmado em produção pra
    grass-seg-dv3ek) — tenta as duas antes de falhar."""
    points = prediction.get("points")
    if points:
        if len(points) < MIN_POLYGON_POINTS:
            raise MaskReconstructionError(
                f"Predição com polígono inválido (precisa de >= {MIN_POLYGON_POINTS} pontos): {points!r}"
            )
        return _polygon_to_binary_mask(points, width=width, height=height)

    rle_mask = prediction.get("rle_mask")
    if rle_mask:
        return _rle_to_binary_mask(rle_mask, width=width, height=height)

    raise MaskReconstructionError(
        f"Predição sem 'points' nem 'rle_mask': {sorted(prediction.keys())}"
    )


def build_mask(
    predictions: List[Dict[str, Any]],
    *,
    width: int,
    height: int,
    class_styles: Dict[str, ClassStyle] = DEFAULT_CLASS_STYLES,
) -> Image.Image:
    canvas = np.zeros((height, width, 4), dtype=np.uint8)

    for prediction in predictions:
        class_name = _resolve_class_name(prediction)
        binary_mask = _resolve_binary_mask(prediction, width=width, height=height)
        style = class_styles.get(class_name.lower())
        color = style.color if style else FALLBACK_CLASS_COLOR
        canvas[binary_mask] = (*color, MASK_FILL_ALPHA)

    return Image.fromarray(canvas, mode="RGBA")
