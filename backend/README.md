# Motiva Platform API

Backend FastAPI responsável por conectar o dashboard da Motiva Platform ao modelo
Roboflow existente e ao banco PostgreSQL do Supabase.

Esta camada foi criada sem alterar a lógica do modelo, o schema do banco ou o
dashboard. A API traduz os contratos entre esses três componentes e persiste cada
inspeção e suas detecções em uma única transação.

## Estado atual

Já está funcionando:

- API FastAPI em Python 3.13;
- worker isolado em Python 3.11 para executar o modelo existente;
- chamada real ao workflow Roboflow;
- validação de imagem Base64 e coordenadas;
- persistência nas tabelas `public.inspections` e `public.detections`;
- consulta de alertas armazenados;
- health check do PostgreSQL;
- CORS para o dashboard local;
- compatibilidade da ponte do modelo com o loop assíncrono usado no Windows;
- testes automatizados e smoke tests reais.

Ainda não faz parte desta branch:

- integração do código da `feature/dashboard`, que ainda está separada da
  `development`;
- atualização persistente do status de um alerta, pois ainda não existe contrato
  aprovado para um endpoint `PATCH`;
- autenticação/autorização da API;
- configuração de deploy e CORS de produção.

## Arquitetura

```text
Dashboard React
      |
      | HTTP/JSON: imagem Base64 + latitude + longitude
      v
FastAPI (Python 3.13)
      |                         |
      | protocolo JSON-lines    | transação PostgreSQL
      v                         v
Worker (Python 3.11)      Supabase/PostgreSQL
      |
      v
Modelo existente -> workflow Roboflow
```

O worker é iniciado automaticamente pela API quando a primeira imagem precisa ser
processada. A comunicação é local e serializada, evitando executar o pacote
`inference_sdk` dentro do ambiente Python 3.13.

## Estrutura relevante

```text
backend/
├── app/
│   ├── config.py             # leitura das variáveis de ambiente
│   ├── database.py           # transações e consultas PostgreSQL
│   ├── database_setup.py     # validação/aplicação controlada do schema
│   ├── domain.py             # regras de classificação e contratos internos
│   ├── main.py               # aplicação FastAPI e endpoints
│   ├── model_gateway.py      # ponte Python 3.13 -> worker Python 3.11
│   └── schemas.py            # contratos HTTP
├── model/                    # modelo existente, executado sem mudança de lógica
├── scripts/                  # smoke tests reais
├── tests/                    # testes automatizados do backend
├── .env.example              # exemplo de configuração da API
├── model_worker.py           # processo isolado do modelo
├── requirements.txt          # dependências de execução da API
└── requirements-dev.txt      # dependências de desenvolvimento e teste

database/
├── migrations/001_initial_schema.sql
└── seeds/demo_data.sql
```

O seed existe no repositório, mas não deve ser executado no banco compartilhado sem
autorização da equipe.

## Requisitos

- Git;
- Python 3.13 para a API;
- Python 3.11 para o worker do modelo;
- acesso ao PostgreSQL/Supabase da equipe;
- credenciais do workflow Roboflow.

No Windows, confirme as versões instaladas:

```powershell
py -3.13 --version
py -3.11 --version
```

## Preparar a branch

```powershell
git fetch origin
git switch feature/backend
git pull --ff-only origin feature/backend
```

Todos os comandos abaixo devem ser executados na raiz do repositório.

## Criar os ambientes

```powershell
py -3.13 -m venv .venv
& '.\.venv\Scripts\python.exe' -m pip install --upgrade pip
& '.\.venv\Scripts\python.exe' -m pip install -r backend\requirements-dev.txt

py -3.11 -m venv .venv-model
& '.\.venv-model\Scripts\python.exe' -m pip install --upgrade pip
& '.\.venv-model\Scripts\python.exe' -m pip install -r backend\model\requirements.txt
```

Os ambientes `.venv` e `.venv-model` são ignorados pelo Git.

## Configuração

Crie os arquivos locais a partir dos exemplos:

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item backend\model\.env.example backend\model\.env
```

No `backend/.env`, configure a conexão PostgreSQL. Para ambientes que não oferecem
IPv6, prefira a URL **Session pooler** disponível em **Supabase > Connect**:

```dotenv
DATABASE_URL=postgresql://postgres.PROJECT_REF:PASSWORD@REGION.pooler.supabase.com:5432/postgres?sslmode=require
CORS_ORIGINS=http://localhost:5173
MODEL_PYTHON_EXECUTABLE=.venv-model\Scripts\python.exe
```

No `backend/model/.env`, configure somente os dados do Roboflow:

```dotenv
ROBOFLOW_API_URL=https://serverless.roboflow.com
ROBOFLOW_API_KEY=SUBSTITUA_LOCALMENTE
ROBOFLOW_WORKSPACE_NAME=SUBSTITUA_LOCALMENTE
ROBOFLOW_WORKFLOW_ID=SUBSTITUA_LOCALMENTE
```

Nunca adicione `.env`, senhas, tokens ou chaves aos commits. Se a senha do banco
possuir caracteres reservados de URL, aplique URL encoding antes de montar a
`DATABASE_URL`.

## Validar o banco

Primeiro execute somente a validação, que não altera dados:

```powershell
Push-Location backend
& '..\.venv\Scripts\python.exe' -m app.database_setup
Pop-Location
```

Resultado esperado quando o banco está pronto:

```text
Schema public.inspections/public.detections compatível.
```

Somente se as duas tabelas estiverem ausentes e o projeto Supabase correto tiver
sido confirmado, aplique a migration existente:

```powershell
Push-Location backend
& '..\.venv\Scripts\python.exe' -m app.database_setup --apply
Pop-Location
```

O comando recusa alterações automáticas quando encontra um schema parcial e nunca
executa `database/seeds/demo_data.sql`.

## Executar a API

No Windows, use o comando testado abaixo:

```powershell
& '.\.venv\Scripts\python.exe' -m uvicorn app.main:app `
  --app-dir backend `
  --port 8000 `
  --reload
```

Endereços locais:

- API: `http://localhost:8000`;
- Swagger: `http://localhost:8000/docs`;
- health check: `http://localhost:8000/health`.

## Endpoints

### `POST /api/v1/inspections`

Recebe uma imagem Base64 e suas coordenadas, executa o modelo e grava a inspeção e
as detecções em uma transação.

```json
{
  "image": "BASE64_DA_IMAGEM",
  "lat": -23.55,
  "lon": -46.82
}
```

Também é aceita uma Data URI, por exemplo
`data:image/jpeg;base64,BASE64_DA_IMAGEM`.

Resposta `201 Created`:

```json
{
  "img_num": "IMG-000001",
  "lat": -23.55,
  "lon": -46.82,
  "classificacao": "alta",
  "confianca": 0.91
}
```

Possíveis erros relevantes:

- `422`: imagem Base64 ou coordenadas inválidas;
- `500`: configuração do modelo ausente;
- `502`: worker indisponível ou falha no Roboflow;
- `503`: PostgreSQL indisponível;
- `504`: timeout do modelo.

### `GET /api/v1/alerts`

Lista os alertas persistidos em ordem decrescente de criação:

```json
[
  {
    "img_num": "IMG-000001",
    "lat": -23.55,
    "lon": -46.82,
    "classificacao": "alta",
    "confianca": 0.91
  }
]
```

### `GET /health`

Com o banco disponível:

```json
{
  "status": "ok",
  "database": "ok"
}
```

Sem configuração ou conexão, responde `503` sem expor a `DATABASE_URL`.

## Integração futura com o dashboard

Quando a `feature/dashboard` entrar na `development`, a integração deve substituir
o armazenamento provisório em `localStorage` nos pontos apropriados:

- upload/análise de imagem -> `POST /api/v1/inspections`;
- mapa/listagem de alertas -> `GET /api/v1/alerts`;
- URL local da API -> proxy do Vite ou variável de ambiente;
- tratamento visual dos códigos `422`, `502`, `503` e `504`.

Antes de criar qualquer endpoint para alteração de status, confirme o contrato com
a equipe responsável pelo dashboard e pelo banco.

## Testes

Testes locais, sem Roboflow real e sem escrever no Supabase:

```powershell
& '.\.venv\Scripts\python.exe' -m ruff check backend
& '.\.venv\Scripts\python.exe' -m pytest -q
& '.\.venv\Scripts\python.exe' -m pip check
& '.\.venv-model\Scripts\python.exe' -m pip check
```

Smoke tests reais do modelo, que consomem o workflow Roboflow mas não gravam no
banco:

```powershell
& '.\.venv-model\Scripts\python.exe' backend\scripts\smoke_model.py
& '.\.venv\Scripts\python.exe' backend\scripts\smoke_gateway.py
```

Validação real da conexão, somente leitura:

```powershell
Push-Location backend
& '..\.venv\Scripts\python.exe' -m app.database_setup
Pop-Location
```

O teste manual de `POST /api/v1/inspections` cria registros reais. Use coordenadas
identificáveis e combine a limpeza com a equipe antes de executá-lo no banco
compartilhado.

## O que foi testado e está funcionando

- lint do backend;
- 20 testes automatizados;
- dependências dos ambientes Python 3.13 e 3.11;
- conexão e schema do Supabase;
- execução do modelo Roboflow pelo worker Python 3.11;
- comunicação entre a API Python 3.13 e o worker;
- criação de inspeções e consulta de alertas pela API;
- Swagger e CORS;
- build e navegação do dashboard, testados separadamente.
