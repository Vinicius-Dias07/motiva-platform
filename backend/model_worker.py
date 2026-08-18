"""JSON-lines worker that runs the unchanged model package under Python 3.11."""

import asyncio
import json
import sys
from typing import Any

from model import (
    MaskReconstructionError,
    MissingConfigError,
    RoboflowCallError,
    RoboflowTimeoutError,
    segment_vegetation,
)

PROTOCOL_PREFIX = "MOTIVA_RESULT\t"


async def process_request(request: dict[str, Any]) -> dict[str, Any]:
    request_id = request.get("request_id")
    image = request.get("image")
    if not isinstance(request_id, str) or not isinstance(image, str):
        return {"request_id": request_id, "ok": False, "error_type": "protocol"}

    try:
        result = await segment_vegetation(image)
    except RoboflowTimeoutError:
        return {"request_id": request_id, "ok": False, "error_type": "timeout"}
    except MissingConfigError:
        return {"request_id": request_id, "ok": False, "error_type": "configuration"}
    except (RoboflowCallError, MaskReconstructionError):
        return {"request_id": request_id, "ok": False, "error_type": "upstream"}
    except Exception:
        return {"request_id": request_id, "ok": False, "error_type": "internal"}

    return {
        "request_id": request_id,
        "ok": True,
        "raw_predictions": result.raw_predictions,
    }


def main() -> None:
    for line in sys.stdin:
        try:
            request = json.loads(line)
            response = asyncio.run(process_request(request))
        except (json.JSONDecodeError, TypeError):
            response = {"request_id": None, "ok": False, "error_type": "protocol"}
        print(PROTOCOL_PREFIX + json.dumps(response, ensure_ascii=True), flush=True)


if __name__ == "__main__":
    main()
