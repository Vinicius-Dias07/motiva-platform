# syntax=docker/dockerfile:1

# Imagem base já traz Python 3.13 para a API FastAPI. O worker do modelo
# (backend/model) precisa rodar isolado em Python 3.11 (inference_sdk/supervision
# não têm build compatível com 3.13) — replicamos aqui a mesma separação de
# venvs descrita em backend/README.md, só que dentro de uma única imagem.
FROM python:3.13-slim-bookworm

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1


# libgl1/libglib2.0-0: opencv-python (dependência do inference_sdk/supervision)
# importa libGL.so.1 em runtime; sem essas libs o worker do modelo crasha
# ao importar cv2 e todo POST /api/v1/inspections vira 502.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3.11 python3.11-venv libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependências da API (Python 3.13)
COPY backend/requirements.txt backend/requirements.txt
RUN pip install -r backend/requirements.txt

# Ambiente isolado do worker do modelo (Python 3.11)
COPY backend/model/requirements.txt backend/model/requirements.txt
RUN python3.11 -m venv /opt/venv-model \
    && /opt/venv-model/bin/pip install --upgrade pip \
    && /opt/venv-model/bin/pip install -r backend/model/requirements.txt

COPY backend/ backend/

ENV MODEL_PYTHON_EXECUTABLE=/opt/venv-model/bin/python

WORKDIR /app/backend

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
