"""Run a real Roboflow smoke test without writing an image or mask to disk."""

import asyncio
import base64
import io
import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from model import segment_vegetation  # noqa: E402


def synthetic_roadside_image() -> str:
    image = Image.new("RGB", (640, 480), (135, 180, 220))
    drawing = ImageDraw.Draw(image)
    drawing.rectangle((0, 280, 640, 480), fill=(55, 130, 55))
    drawing.polygon([(190, 480), (300, 250), (430, 250), (560, 480)], fill=(75, 75, 75))
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=90)
    return base64.b64encode(buffer.getvalue()).decode("ascii")


async def main() -> None:
    result = await segment_vegetation(synthetic_roadside_image())
    print(
        f"Roboflow OK: {result.width}x{result.height}, "
        f"{result.predictions_count} predições, máscara com {len(result.mask_png_bytes)} bytes"
    )


if __name__ == "__main__":
    asyncio.run(main())
