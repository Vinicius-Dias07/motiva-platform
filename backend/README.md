# Motiva Platform API

Camada FastAPI que conecta o dashboard ao modelo existente em `backend/model` e às
tabelas PostgreSQL existentes em `database/migrations/001_initial_schema.sql`.

## Requisitos

- Python 3.13 para a API
- Python 3.11 para o worker do modelo, pois `inference_sdk` exige Python menor que 3.13
- Acesso ao projeto Supabase da equipe
- Credenciais do workflow Roboflow

## Ambiente local

Na raiz do repositório, crie o ambiente virtual com o Python 3.13 e instale as
dependências:

```powershell
& 'C:\Users\ansel\AppData\Local\Programs\Python\Python313\python.exe' -m venv .venv
& '.\.venv\Scripts\python.exe' -m pip install -r backend\requirements-dev.txt
& 'C:\Users\ansel\AppData\Local\Programs\Python\Python311\python.exe' -m venv .venv-model
& '.\.venv-model\Scripts\python.exe' -m pip install -r backend\model\requirements.txt
```

Copie `backend/.env.example` para `backend/.env` e use a URL **Session pooler**
do Supabase. Copie `backend/model/.env.example` para `backend/model/.env` e preencha
os valores do Roboflow. Os dois arquivos `.env` são ignorados pelo Git. A API
permanece em Python 3.13 e conversa por um protocolo local com o modelo inalterado
executado em Python 3.11.

Nunca envie as credenciais para commits, logs ou respostas HTTP.

## Banco de dados

Somente validar o schema:

```powershell
Push-Location backend
& '..\.venv\Scripts\python.exe' -m app.database_setup
Pop-Location
```

Se as duas tabelas estiverem ausentes e o projeto Supabase correto tiver sido
confirmado, aplicar exatamente a migration existente:

```powershell
Push-Location backend
& '..\.venv\Scripts\python.exe' -m app.database_setup --apply
Pop-Location
```

O script nunca executa o seed de demonstração e recusa alterações automáticas quando
encontra schema parcial.

## Executar

```powershell
& '.\.venv\Scripts\python.exe' -m uvicorn app.main:app --app-dir backend --reload
```

Documentação interativa: `http://127.0.0.1:8000/docs`.

## Contratos

- `POST /api/v1/inspections`: recebe `image`, `lat` e `lon`, executa o modelo e
  persiste inspeção/detecções em uma transação.
- `GET /api/v1/alerts`: lista `img_num`, coordenadas, classificação e confiança.
- `GET /health`: verifica a conexão PostgreSQL.

Exemplo de resposta:

```json
{
  "img_num": "IMG-000001",
  "lat": -23.55,
  "lon": -46.82,
  "classificacao": "alta",
  "confianca": 0.91
}
```

## Testes

```powershell
& '.\.venv\Scripts\python.exe' -m ruff check backend
& '.\.venv\Scripts\python.exe' -m pytest
```

Com as credenciais Roboflow configuradas, os smoke tests reais são:

```powershell
& '.\.venv-model\Scripts\python.exe' backend\scripts\smoke_model.py
& '.\.venv\Scripts\python.exe' backend\scripts\smoke_gateway.py
```

O segundo comando valida também a ponte Python 3.13 → Python 3.11 e o contrato
de classificação/detecções usado pelo banco.
