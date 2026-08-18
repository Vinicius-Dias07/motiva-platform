import sys

from app.config import Settings
from app.model_gateway import ModelWorkerClient


async def test_worker_bridge_does_not_depend_on_asyncio_subprocess(tmp_path) -> None:
    worker = tmp_path / "fake_worker.py"
    worker.write_text(
        "import json, sys\n"
        "for line in sys.stdin:\n"
        "    request = json.loads(line)\n"
        "    response = {'request_id': request['request_id'], 'ok': True, "
        "'raw_predictions': [{'class': 'grass_short', 'confidence': 0.25}]}\n"
        "    print('MOTIVA_RESULT\\t' + json.dumps(response), flush=True)\n",
        encoding="utf-8",
    )
    settings = Settings(
        _env_file=None,
        model_python_executable=sys.executable,
        model_worker_timeout_seconds=5,
    )
    gateway = ModelWorkerClient(settings)
    gateway._worker_path = worker

    try:
        result = await gateway.segment("aW1hZ2U=")
    finally:
        await gateway.close()

    assert result.raw_predictions == [{"class": "grass_short", "confidence": 0.25}]
    assert gateway._process is None
