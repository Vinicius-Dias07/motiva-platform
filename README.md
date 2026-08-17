Instruções de requerimentos e uso do código:

# ========================

## Requisitos

É necessário ter instalado:

- Python
- Node.js
- npm

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

Caso a imagem não possua dados GPS válidos:

- A imagem não é enviada para análise.
- O sistema informa que o GPS não foi encontrado.

Caso a imagem possua GPS válido:

- A imagem é aceita.
- Latitude e longitude são armazenadas.
- A imagem segue para a análise simulada.

A leitura dos dados GPS é realizada utilizando a biblioteca `exifr`.

# ========================

## IA simulada

A IA utilizada atualmente é apenas uma simulação para testes.

Ela pode retornar classificações:

- Baixa
- Média
- Alta

Também são simulados:

- Confiança da análise
- Vegetação detectada
- Área não roçada

A IA real será integrada posteriormente ao projeto.

# ========================

## Banco de dados provisório

Enquanto o banco de dados real está sendo desenvolvido, o projeto utiliza o `localStorage` do navegador como armazenamento provisório.

São armazenadas informações separadas para:

- Imagens
- Análises
- Alertas

Esse armazenamento é utilizado apenas para testes e desenvolvimento.

Posteriormente, ele será substituído pelo banco de dados definitivo do projeto.

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

Por compatibilidade de dependências, a API roda em Python 3.13 e utiliza um worker
local Python 3.11 para executar o módulo Roboflow existente sem modificá-lo.
