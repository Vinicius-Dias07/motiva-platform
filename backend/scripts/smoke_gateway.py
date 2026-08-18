"""Exercise the Python 3.13 -> Python 3.11 model worker bridge."""

import asyncio
import base64
import struct
import sys
import zlib
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import get_settings  # noqa: E402
from app.domain import predictions_to_detection_records, summarize_predictions  # noqa: E402
from app.model_gateway import ModelWorkerClient  # noqa: E402


def png_chunk(kind: bytes, data: bytes) -> bytes:
    payload = kind + data
    return struct.pack(">I", len(data)) + payload + struct.pack(">I", zlib.crc32(payload))


def synthetic_green_png() -> str:
    width, height = 640, 480
    row = b"\x00" + bytes((55, 130, 55)) * width
    pixels = row * height
    header = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    png = (
        b"\x89PNG\r\n\x1a\n"
        + png_chunk(b"IHDR", header)
        + png_chunk(b"IDAT", zlib.compress(pixels))
        + png_chunk(b"IEND", b"")
    )
    return base64.b64encode(png).decode("ascii")


async def main() -> None:
    gateway = ModelWorkerClient(get_settings())
    try:
        result = await gateway.segment(synthetic_green_png())
        summary = summarize_predictions(result.raw_predictions)
        detections = predictions_to_detection_records(result.raw_predictions)
        print(
            f"Gateway 3.13 -> 3.11 OK: {len(detections)} detecções, "
            f"classificação={summary.classificacao}, confiança={summary.confianca:.3f}"
        )
    finally:
        await gateway.close()


if __name__ == "__main__":
    asyncio.run(main())
