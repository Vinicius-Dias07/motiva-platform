Instruções de requerimentos e uso do código:

# ========================

## Requisitos

É necessário ter instalado:

- Python
- Node.js
- npm

# ========================

## Como rodar a aplicação completa

Passo a passo para subir o backend (API + modelo) e o dashboard juntos, localmente.
O gerador de mapas (seção seguinte) é um script auxiliar independente, não é
necessário para rodar a aplicação.

### 1. Backend (API + modelo)

```powershell
py -3.12 -m venv .venv
& '.\.venv\Scripts\python.exe' -m pip install --upgrade pip
& '.\.venv\Scripts\python.exe' -m pip install -r backend\requirements-dev.txt
& '.\.venv\Scripts\python.exe' -m pip install -r backend\model\requirements.txt
```

Localmente o backend inteiro (API + módulo do modelo) roda numa única venv — não
é necessário manter dois Pythons separados para isso funcionar.

Crie os arquivos de configuração a partir dos exemplos:

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item backend\model\.env.example backend\model\.env
```

Em `backend/.env`, configure a `DATABASE_URL` do Supabase e aponte o worker do
modelo para a mesma venv:

```dotenv
DATABASE_URL=postgresql://postgres.PROJECT_REF:PASSWORD@REGION.pooler.supabase.com:5432/postgres?sslmode=require
CORS_ORIGINS=http://localhost:5173
MODEL_PYTHON_EXECUTABLE=.venv\Scripts\python.exe
```

Em `backend/model/.env`, configure as credenciais do Roboflow
(`ROBOFLOW_API_KEY`, `ROBOFLOW_WORKSPACE_NAME`, `ROBOFLOW_WORKFLOW_ID`). Nunca
commite esses arquivos `.env` — eles já estão no `.gitignore`.

Suba a API:

```powershell
& '.\.venv\Scripts\python.exe' -m uvicorn app.main:app `
  --app-dir backend `
  --port 8000 `
  --reload `
  --loop asyncio:SelectorEventLoop
```

O `--loop asyncio:SelectorEventLoop` é obrigatório no Windows (ver detalhes em
[`backend/README.md`](backend/README.md)). A API fica disponível em
`http://localhost:8000` (`/health` e `/docs`).

### 2. Dashboard

Em outro terminal:

```bash
cd dashboard_figma
npm install
npm run dev
```

O Vite mostra o endereço local (por padrão `http://localhost:5173`). Com a API
rodando em `http://localhost:8000`, o dashboard já consegue enviar imagens para
análise e listar os alertas reais.

Documentação completa do backend (arquitetura, dois-Pythons opcional para
paridade de produção, endpoints, testes) em
[`backend/README.md`](backend/README.md).

# ========================

## Python

O Python é utilizado para o gerador e preparação dos mapas.

Bibliotecas utilizadas:

```bash
pip install folium
pip install geopandas
pip install shapely
```

O projeto também utiliza bibliotecas nativas do Python, como:

- json
- pathlib

# ========================

## Como executar o gerador de mapas

Entre pelo terminal na pasta:

```bash
cd mapas
```

Execute:

```bash
python gerador_mapa_rodovias.py
```

O programa gera:

```text
mapa_rodovias.html
```

O gerador é utilizado para preparar e organizar os dados geográficos do projeto.

# ========================

## Dashboard

O projeto possui uma interface desenvolvida com React e Vite, localizada em:

```text
dashboard_figma/
```

O mapa principal do dashboard atualmente utiliza React-Leaflet.

Os arquivos GeoJSON utilizados pelo mapa ficam em:

```text
dashboard_figma/public/geojson/
```

Atualmente são utilizados:

- autoban.geojson
- rodoanel_rocada.geojson
- via_dutra.geojson

# ========================

## Dependências do Dashboard

As dependências do dashboard são instaladas dentro da pasta:

```bash
cd dashboard_figma
```

Para instalar todas as dependências do projeto:

```bash
npm install
```

Entre as principais bibliotecas utilizadas atualmente estão:

```text
exifr
leaflet
react-leaflet
```

Para suporte ao TypeScript com Leaflet também é utilizado:

```text
@types/leaflet
```

Essas dependências já estão registradas no `package.json`, portanto normalmente basta executar:

```bash
npm install
```

em uma nova máquina.

Caso seja necessário instalá-las manualmente:

```bash
npm install exifr
npm install leaflet@1.9.4 react-leaflet@4
npm install -D @types/leaflet
```

# ========================

## Executar o Dashboard

Entre na pasta:

```bash
cd dashboard_figma
```

Instale as dependências:

```bash
npm install
```

Execute o projeto:

```bash
npm run dev
```

O Vite fornecerá o endereço local para acessar o dashboard pelo navegador.

# ========================

## Upload e análise de imagens

O dashboard permite o upload de imagens de rodovias e vegetação.

Cada imagem recebe um identificador, por exemplo:

```text
IMG-000001
```

O sistema verifica os metadados EXIF da imagem e procura latitude e longitude.

**GPS é opcional.** Isso permite testar a análise com qualquer imagem, mesmo
sem metadados de localização embutidos:

- Caso a imagem possua GPS válido no EXIF, latitude e longitude são lidas
  diretamente do arquivo.
- Caso a imagem não possua GPS válido, o sistema usa uma coordenada de
  fallback (região de São Paulo) com uma variação aleatória de até ~1km, só
  para evitar que várias imagens sem GPS caiam exatamente no mesmo ponto do
  mapa.

Em ambos os casos a imagem segue normalmente para a análise real (backend +
modelo).

A leitura dos dados GPS é realizada utilizando a biblioteca `exifr`.

# ========================

## IA

A análise já é real: o dashboard envia a imagem para o backend
([`backend/README.md`](backend/README.md)), que aciona o modelo de
segmentação de vegetação hospedado no Roboflow e devolve a classificação.

A classificação retornada pode ser:

- Baixa
- Média
- Alta

Ela é decidida pela classe de altura de mato (`mato_curto`/`mato_medio`/
`mato_longo`) com **maior área total** detectada na imagem — não basta a
classe mais severa aparecer isoladamente, ela precisa dominar a imagem em
área. Junto da classificação vem a confiança da análise.

Se o backend estiver fora do ar ou a chamada ao modelo falhar, o dashboard
mostra uma mensagem de erro em vez de simular um resultado.

# ========================

## Banco de dados

A persistência definitiva de cada inspeção e suas detecções acontece no
backend, em PostgreSQL/Supabase (`POST /api/v1/inspections`, ver
[`backend/README.md`](backend/README.md)).

O dashboard também mantém uma cópia local em `localStorage` do navegador
(imagens, análises e alertas), usada como cache/UX — ao carregar a tela de
alertas, o dashboard busca `GET /api/v1/alerts` na API e faz merge com o que
já está no `localStorage`, para alertas criados localmente não desaparecerem
enquanto essa busca ainda está em andamento.

# ========================

## Alertas

Cada alerta possui informações como:

- ID do alerta
- Severidade
- Status
- ID da imagem
- Latitude
- Longitude
- Confiança da análise

# ========================

## Mapa

O mapa do dashboard utiliza:

- React
- Leaflet
- React-Leaflet
- GeoJSON

As rodovias são carregadas diretamente pelos arquivos GeoJSON disponíveis em:

```text
dashboard_figma/public/geojson/
```

Atualmente estão disponíveis:

- Rodoanel Oeste
- Via Dutra
- AutoBAn

# ========================

## Backend

O backend FastAPI, os contratos HTTP, a configuração do Supabase e os comandos de
teste estão documentados em [`backend/README.md`](backend/README.md).

Localmente, uma única venv Python já roda tanto a API quanto o worker do modelo
(ver "Como rodar a aplicação completa" acima). `backend/README.md` também
documenta uma variante com dois Pythons separados (3.13 para a API, 3.11 para o
worker), útil para paridade com um ambiente de produção que exija essa divisão.
