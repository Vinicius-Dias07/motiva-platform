# `model/` — integração com Roboflow

Módulo responsável por acionar o workflow de segmentação de vegetação
hospedado no Roboflow (`grass-seg-dv3ek`), reconstruir a máscara de
segmentação a partir das predições e expor um resultado pronto pra API/
frontend consumir.

## Contexto

Projeto de visão computacional (FIAP + Motiva) para classificar altura de
vegetação em faixas de rodovia (alto/médio/baixo). Este módulo não expõe
rota HTTP própria — ele expõe funções Python (`segment_vegetation`) que uma
camada de API (fora deste escopo) chama depois de extrair a imagem do
payload recebido do frontend.

## Instalação

```bash
pip install -r requirements.txt
```

Copie `.env.example` para `.env` e preencha `ROBOFLOW_API_KEY` (e ajuste
`ROBOFLOW_WORKSPACE_NAME`/`ROBOFLOW_WORKFLOW_ID` se necessário). **`.env`
nunca deve ser commitado** — já está no `.gitignore` da raiz do repositório.

## Estrutura

```
backend/model/
├── __init__.py            # API pública do módulo
├── config.py               # leitura de env vars (API key, url, workspace, workflow id)
├── exceptions.py            # exceções próprias do módulo
├── roboflow_client.py        # só fala com o Roboflow (isolado, testável com mock)
├── mask_reconstructor.py     # só reconstrói a máscara a partir de predictions
├── inference_service.py      # orquestra client + reconstructor — ponto de entrada
├── main.py                    # script manual de smoke-test
├── .env / .env.example
└── requirements.txt
```

Responsabilidades separadas propositalmente:
- (a) só fala com Roboflow → `roboflow_client.py`
- (b) só reconstrói a máscara → `mask_reconstructor.py`
- (c) orquestra as duas → `inference_service.py`

## Uso

```python
from model import segment_vegetation

result = await segment_vegetation(image_base64)

result.mask_png_bytes    # bytes do PNG da máscara reconstruída
result.mask_base64        # o mesmo PNG em base64 (conveniência p/ JSON/data URI)
result.width, result.height
result.predictions_count
result.raw_predictions    # lista crua de predições, sem reprocessar o JSON
```

### Entrada: `image_base64: str`

O frontend envia a imagem dentro de um JSON que também carrega outros
campos (não é `multipart/form-data` puro) — por isso a imagem chega como
string base64. A camada de API extrai esse campo do payload e passa a
string direto pra `segment_vegetation`; o módulo `model/` não sabe nada
sobre os outros campos do payload.

O `inference_sdk` aceita base64 nativamente
(`images={"image": "<base64>"}`), então a string é passada quase direto
pro SDK, sem round-trip de decode/reencode. **Não há I/O de disco em
nenhum ponto do pipeline** — tudo fica em memória (string base64,
`PIL.Image` quando precisamos decodificar para ler width/height de
fallback, e o PNG de saída).

### Chamada assíncrona ao Roboflow

`InferenceHTTPClient.run_workflow` é síncrono/bloqueante. `roboflow_client.run_workflow`
embrulha a chamada com `asyncio.to_thread` + `asyncio.wait_for(timeout)`
para não travar o event loop. Limitação conhecida: `asyncio.to_thread` não
é cancelável de verdade — se o timeout estourar, a chamada ao Roboflow
segue rodando em background até responder sozinha; o `wait_for` só libera
o caller mais cedo.

### Erros

Todas as funções propagam exceções tipadas de `exceptions.py` — nenhuma
engole erro ou retorna `None` silenciosamente:

| Exceção | Quando |
|---|---|
| `MissingConfigError` | env var obrigatória ausente (`ROBOFLOW_API_KEY`, etc.) |
| `RoboflowCallError` | erro do SDK/HTTP ao chamar o workflow (guarda `status_code` e `cause`) |
| `RoboflowTimeoutError` | chamada excedeu o `timeout` |
| `MaskReconstructionError` | JSON de predições em formato inesperado |

Sugestão de mapeamento HTTP pra quem for expor isso numa API:
`RoboflowTimeoutError` → 504, `RoboflowCallError`/`MaskReconstructionError` → 502,
`MissingConfigError` → 500 (erro de configuração do servidor, não do request).

## Como o backend deve integrar

### 1. Import

`backend/model/` é um pacote Python (`model`, tem `__init__.py`), mas
`backend/` **não** tem `__init__.py` — então o processo do backend precisa
rodar com `backend/` na raiz do `PYTHONPATH` pra `import model` funcionar.
Duas formas de garantir isso:

- Rodando o processo da API a partir de `backend/` (`cwd = backend/`), ou
  com `PYTHONPATH=backend` setado no ambiente/Dockerfile.
- Ou, se preferir não depender do cwd, inserir o caminho no topo do arquivo
  que faz o import — é exatamente o que `main.py` faz:
  ```python
  import sys
  from pathlib import Path
  sys.path.insert(0, str(Path(__file__).resolve().parent.parent))  # aponta pra backend/
  from model import segment_vegetation
  ```

### 2. Extrair o base64 do payload

O módulo não sabe nada sobre o resto do payload (outros campos que o
frontend manda junto) — quem integra extrai só o campo da imagem antes de
chamar `segment_vegetation`:

```python
image_base64 = request_body["image"]  # ou o nome do campo que o front usar
# não faça strip do prefixo "data:image/png;base64," aqui dentro do model/ —
# se o front mandar como data URI, remova o prefixo na camada de API antes
# de chamar segment_vegetation, ex.: image_base64.split(",", 1)[-1]
```

### 3. Chamar e mapear erros pra resposta HTTP

`segment_vegetation` é `async` e propaga exceções tipadas — não retorna
`None`/erro silencioso. Exemplo de handler (ilustrativo, com FastAPI, já
que ainda não há framework HTTP decidido/instalado no projeto — adapte pro
framework real quando for definido):

```python
from fastapi import FastAPI, HTTPException
from model import (
    segment_vegetation,
    RoboflowTimeoutError,
    RoboflowCallError,
    MaskReconstructionError,
    MissingConfigError,
)

app = FastAPI()

@app.post("/segmentacao")
async def segmentacao(payload: dict):
    image_base64 = payload["image"]
    try:
        result = await segment_vegetation(image_base64)
    except RoboflowTimeoutError:
        raise HTTPException(status_code=504, detail="Roboflow não respondeu a tempo")
    except (RoboflowCallError, MaskReconstructionError):
        raise HTTPException(status_code=502, detail="Falha ao processar a imagem")
    except MissingConfigError:
        raise HTTPException(status_code=500, detail="Configuração do servidor ausente")

    return {
        "mask_base64": result.mask_base64,
        "width": result.width,
        "height": result.height,
        "predictions_count": result.predictions_count,
    }
```

Pontos de atenção pra quem for preencher/adaptar esse handler:
- `MissingConfigError` normalmente só deveria acontecer na subida do
  processo (env var faltando) — pode fazer sentido chamar
  `config.get_settings()` uma vez no startup da API só pra falhar cedo, em
  vez de deixar isso estourar no primeiro request.
- `timeout` de `segment_vegetation(image_base64, timeout=...)` tem default
  de 30s (`roboflow_client.DEFAULT_TIMEOUT_SECONDS`) — ajuste conforme o
  SLA da API.
- A resposta acima devolve `mask_base64` (pronta pra virar
  `data:image/png;base64,...` no frontend) — se preferir devolver os bytes
  crus (`image/png` direto), use `result.mask_png_bytes` numa `Response`
  com `media_type="image/png"` em vez de retornar JSON.

## Formato real do JSON do Roboflow (confirmado com inferência real)

O workflow `grass-seg-dv3ek` é customizado — a estrutura abaixo foi
validada rodando `python main.py` contra a API de verdade (não é mais
suposição):

1. `run_workflow(...)` devolve uma **lista** com 1 item (1 imagem enviada em
   `images={"image": ...}`) — usa `result[0]`.
2. `result[0]` tem as chaves `predictions`, `inference_id`, `model_id`.
   `result[0]["predictions"]` é um **dict aninhado**:
   `{"image": {"width": None, "height": None}, "predictions": [...]}`.
   `extract_predictions` também aceita `predictions` como lista direta
   (variante mais comum em outros workflows do Roboflow), mas na prática
   observada é sempre o dict aninhado.
3. **`predictions.image.width/height` vêm sempre `None`** nesse workflow —
   o fallback que decodifica `image_base64` (em memória, via PIL) pra ler o
   tamanho real não é só uma proteção teórica, é o caminho usado sempre.
4. Cada predição individual **não tem `points`** (polígono) — tem bounding
   box (`x`, `y`, `width`, `height`, centro-formato) e a segmentação de
   verdade vem em **`rle_mask`**: `{"size": [height, width], "counts": "<RLE comprimido estilo COCO/pycocotools>"}`,
   cobrindo a imagem inteira (não é recortado pelo bbox). A classe vem em
   `"class"` (ex.: `"grass_medium"`).
5. `mask_reconstructor._resolve_binary_mask` decodifica `rle_mask` com
   `supervision.rle_to_mask(counts, (width, height))` — validado batendo a
   contagem de pixels do mask decodificado contra a área do bbox de cada
   predição (mask sempre menor ou igual à área do bbox, como esperado). O
   parser também aceita `points` como alternativa (caso outro workflow do
   Roboflow devolva polígono em vez de RLE), mas isso não foi observado na
   prática.
6. Classes reais observadas numa única inferência de teste: `grass_medium`,
   `grass_short`, `non_grass_veg`. `grass_tall` não apareceu na imagem
   testada, mas é assumida por simetria (`grass_short`/`grass_medium`
   sugerem uma terceira classe de altura). Classes desconhecidas caem no
   fallback cinza (`FALLBACK_CLASS_COLOR`) em vez de quebrar o parser.

Se a estrutura real divergir num caso novo (ex.: workflow atualizado),
`MaskReconstructionError` é levantada com as chaves realmente recebidas na
mensagem, pra facilitar o ajuste — `mask_reconstructor.py` é o único lugar
que precisa mudar.

## Smoke test manual

```bash
python main.py
```

Lê `image.png`, converte pra base64, chama `segment_vegetation` e imprime
contagem de predições, dimensões e tamanho do PNG gerado, salvando o
resultado em `mask_output.png` para conferência visual (esse arquivo é só
para debug local, não deve ser commitado).

## Fora de escopo deste módulo

- Endpoint HTTP para expor `segment_vegetation` (aguardando definição do
  framework/API do backend).
- Storage/upload da máscara para S3 ou disco público — o módulo devolve
  bytes/base64 em memória; decisões de persistência ficam pra camada que
  chamar este módulo.
- Testes automatizados (pytest) — não fazia parte do pedido original.
