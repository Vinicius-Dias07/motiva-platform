Instruções de requerimentos e uso do código:

Python

É necessário ter o Python instalado.

Bibliotecas utilizadas:

pip install folium
pip install geopandas

O projeto também utiliza:

- json
- pathlib
- shapely

# ========================

Como executar o gerador de mapas

Entre pelo terminal na pasta:

cd mapas

Execute:

python gerador_mapa_rodovias.py

O programa irá gerar:

mapa_rodovias.html

# ========================

Dashboard

O projeto também possui uma interface desenvolvida com Figma Make, localizada em:

dashboard_figma/

O dashboard possui atualmente as seguintes áreas:

- Mapa
- Análise
- Alertas
- Imagens
- Configurações

O mapa é carregado automaticamente ao iniciar o dashboard.

# ========================

Executar o dashboard

Entre na pasta:

cd dashboard_figma

Instale as dependências:

npm install

Execute o projeto:

npm run dev

O Vite fornecerá o endereço local para acessar o dashboard pelo navegador.

# ========================

Upload e análise de imagens

O dashboard permite o upload de imagens de rodovias e vegetação.

Cada imagem recebe um identificador, por exemplo:

IMG-000001

O sistema verifica os metadados EXIF da imagem e procura latitude e longitude.

Caso a imagem não possua dados GPS válidos:

- A imagem não é enviada para análise.
- O sistema informa que o GPS não foi encontrado.

Caso a imagem possua GPS válido:

- A imagem é aceita.
- Latitude e longitude são armazenadas.
- A imagem é enviada para a etapa de análise simulada.

# ========================

IA simulada

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

Banco de dados provisório

Enquanto o banco de dados real está sendo desenvolvido, o projeto utiliza o localStorage do navegador como armazenamento provisório.

São armazenadas informações separadas para:

- Imagens
- Análises
- Alertas

Esse armazenamento é utilizado apenas para testes e desenvolvimento.

Posteriormente, ele será substituído pelo banco de dados definitivo do projeto.

# ========================

Alertas

Após a análise simulada, a imagem pode gerar um alerta.

Cada alerta possui informações como:

- ID do alerta
- Severidade
- Status
- ID da imagem
- Latitude
- Longitude
- Confiança da análise

Os alertas também podem ter seu status alterado no dashboard.

# ========================

Estado atual do projeto

Atualmente já estão funcionando:

- Mapa de múltiplas rodovias
- Dashboard em React/Vite
- Upload de imagens
- Leitura de GPS por EXIF
- Validação das coordenadas
- Geração de ID das imagens
- IA simulada
- Geração de análises
- Geração de alertas
- Armazenamento provisório no localStorage

Em desenvolvimento:

- Banco de dados definitivo
- Modelo de IA real
- Integração dos alertas com o mapa
- Outras funcionalidades de monitoramento
