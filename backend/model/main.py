import asyncio
import base64
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from model.inference_service import segment_vegetation  # noqa: E402

IMAGE_PATH = Path(__file__).resolve().parent / "image.png"


async def main() -> None:
    image_base64 = base64.b64encode(IMAGE_PATH.read_bytes()).decode("ascii")
    result = await segment_vegetation(image_base64)

    print(f"predictions_count: {result.predictions_count}")
    print(f"mask size: {result.width}x{result.height}")
    print(f"mask PNG bytes: {len(result.mask_png_bytes)}")

    output_path = Path(__file__).resolve().parent / "mask_output.png"
    output_path.write_bytes(result.mask_png_bytes)
    print(f"máscara salva em {output_path} (apenas para conferência manual)")


if __name__ == "__main__":
    asyncio.run(main())
