# ============================================================
# MAPA INTERATIVO DE RODOVIAS MOTIVA
# ============================================================
#
# OBJETIVO:
# Criar um mapa interativo de rodovias utilizando:
#
# - GeoJSON da rodovia
# - Folium
# - GeoPandas
#
# O mapa permite:
#
# ✔ Exibir as linhas das rodovias
# ✔ Adicionar pontos coloridos
# ✔ Simular classificações
#
# ============================================================

# ============================================================
# IMPORTAÇÃO DAS BIBLIOTECAS
# ============================================================

import folium
import geopandas as gpd
import json
from folium.plugins import Draw
from pathlib import Path
from shapely.geometry import box

# ============================================================
# 1. CARREGAR O ARQUIVO GEOJSON
# ============================================================
#
# Este arquivo contém:
# - geometria da rodovia
# - coordenadas
# - pontos ou linhas
#
# IMPORTANTE:
# O arquivo deve estar na mesma pasta do código.
#
# ============================================================

# ============================================================
# CARREGAR RODOANEL (OESTE)
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent

arquivo_vegetacao = BASE_DIR / "dados" / "vegetacao" / "classificacao_rocada.geojson"
arquivo_dutra = BASE_DIR / "dados" / "rodovias" / "via_dutra.geojson"
arquivo_autoban = BASE_DIR / "dados" / "rodovias" / "autoban.geojson"

# Ler arquivo usando GeoPandas
gdf = gpd.read_file(arquivo_vegetacao)

# Garantir sistema de coordenadas correto
gdf = gdf.to_crs(epsg=4326)

# ============================================================
# CARREGAR VIA DUTRA
# ============================================================

# Ler GeoJSON da Via Dutra
gdf_dutra = gpd.read_file(arquivo_dutra)

# Garantir o mesmo sistema de coordenadas
gdf_dutra = gdf_dutra.to_crs(epsg=4326)

# Separar possíveis geometrias agrupadas
gdf_dutra = gdf_dutra.explode(index_parts=False)

# ============================================================
# CARREGAR AUTOBAN
# ============================================================

gdf_autoban = gpd.read_file(arquivo_autoban)

# Garantir sistema de coordenadas correto
gdf_autoban = gdf_autoban.to_crs(epsg=4326)

# Separar geometrias agrupadas, se existirem
gdf_autoban = gdf_autoban.explode(index_parts=False)

# ============================================================
# 2. CONFIGURAÇÃO DOS TRECHOS DO RODOANEL
# ============================================================

TRECHOS = {

    "OESTE": {

        "oeste": -46.84,
        "leste": -46.73,

        "sul": -23.63,
        "norte": -23.415,

        "cor": "blue"
    },

    "SUL": {

        "oeste": -46.73,
        "leste": -46.55,

        "sul": -23.80,
        "norte": -23.63,

        "cor": "green"
    },

    "LESTE": {

        "oeste": -46.55,
        "leste": -46.35,

        "sul": -23.65,
        "norte": -23.40,

        "cor": "red"
    }
}

# ============================================================
# 3. ESCOLHER O TRECHO ATUAL
# ============================================================
#
# Basta trocar:
#
# "OESTE"
# "SUL"
# "LESTE"
#
# ============================================================

TRECHO_ATUAL = TRECHOS["OESTE"]

# ============================================================
# 4. CRIAR ÁREA DE RECORTE (BOUNDING BOX)
# ============================================================
#
# O box define a área que será exibida.
#
# Tudo fora desses limites será removido.
#
# ============================================================

bbox = box(

    TRECHO_ATUAL["oeste"],
    TRECHO_ATUAL["sul"],

    TRECHO_ATUAL["leste"],
    TRECHO_ATUAL["norte"]
)

# ============================================================
# 5. RECORTAR O MAPA
# ============================================================
#
# Mantém apenas o trecho desejado.
#
# ============================================================

gdf_trecho = gdf.clip(bbox)

# ============================================================
# 6. MANTER SOMENTE A GEOMETRIA
# ============================================================
#
# Remove colunas desnecessárias.
#
# ============================================================

gdf_trecho = gdf_trecho[["geometry"]]

# ============================================================
# 7. SEPARAR MULTILINES
# ============================================================
#
# Alguns GeoJSON possuem linhas agrupadas.
#
# explode() separa tudo corretamente.
#
# ============================================================

gdf_trecho = gdf_trecho.explode(index_parts=False)

# ============================================================
# 8. FUNÇÃO DE CLASSIFICAÇÃO
# ============================================================
#
# Esta função converte:
#
# "baixa"  -> verde
# "media"  -> amarelo
# "alta"   -> vermelho
#
# FUTURAMENTE:
# outro código poderá alterar a classificação automaticamente.
#
# ============================================================

def definir_cor(classificacao):

    cores = {

        "baixa": "green",

        "media": "yellow",

        "alta": "red"
    }

    return cores.get(classificacao, "blue")

# ============================================================
# 9. CRIAR O MAPA
# ============================================================
#
# location:
# posição inicial do mapa
#
# zoom_start:
# nível de zoom inicial
#
# tiles:
# estilo visual do mapa
#
# ============================================================

mapa = folium.Map(

    location=[-23.58, -46.72],

    zoom_start=11,

    tiles="CartoDB dark_matter"
)

# ============================================================
# 10. DESENHAR O TRECHO DA RODOVIA
# ============================================================
#
# Desenha a linha principal da rodovia.
#
# ============================================================

# ============================================================
# CAMADAS DE RODOVIAS
# ============================================================

# RODOANEL OESTE
folium.GeoJson(
    gdf_trecho.__geo_interface__,
    name="Trecho Oeste - Rodoanel",
    style_function=lambda x: {
        "color": "blue",
        "weight": 7,
        "opacity": 0.95
    }
).add_to(mapa)


# VIA DUTRA
folium.GeoJson(
    gdf_dutra.__geo_interface__,
    name="Via Dutra - BR-116",
    style_function=lambda x: {
        "color": "red",
        "weight": 6,
        "opacity": 0.95
    }
).add_to(mapa)


# AUTOBAN - ANHANGUERA
folium.GeoJson(
    gdf_autoban[
        gdf_autoban["rodovia"] == "SP-330"
    ].__geo_interface__,
    name="SP-330 - Anhanguera",
    style_function=lambda x: {
        "color": "orange",
        "weight": 6,
        "opacity": 0.95
    }
).add_to(mapa)


# AUTOBAN - BANDEIRANTES
folium.GeoJson(
    gdf_autoban[
        gdf_autoban["rodovia"] == "SP-348"
    ].__geo_interface__,
    name="SP-348 - Bandeirantes",
    style_function=lambda x: {
        "color": "cyan",
        "weight": 6,
        "opacity": 0.95
    }
).add_to(mapa)


# AUTOBAN - DOM GABRIEL
folium.GeoJson(
    gdf_autoban[
        gdf_autoban["rodovia"] == "SP-300"
    ].__geo_interface__,
    name="SP-300 - Dom Gabriel",
    style_function=lambda x: {
        "color": "violet",
        "weight": 6,
        "opacity": 0.95
    }
).add_to(mapa)


# AUTOBAN - ADALBERTO PANZAN
folium.GeoJson(
    gdf_autoban[
        gdf_autoban["rodovia"] == "SPI-102/330"
    ].__geo_interface__,
    name="SPI-102/330 - Adalberto Panzan",
    style_function=lambda x: {
        "color": "lime",
        "weight": 6,
        "opacity": 0.95
    }
).add_to(mapa)

# ============================================================
# 11. PONTOS MANUAIS DE TESTE
# ============================================================
#
# ESTES PONTOS SÃO TEMPORÁRIOS.
#
# Servem apenas para:
#
# ✔ testar as cores
# ✔ validar o sistema
# ✔ visualizar o mapa
#
# FUTURAMENTE:
# outro código irá gerar estes pontos automaticamente.
#
# ============================================================

pontos_teste = [

    # --------------------------------------------------------
    # PONTO VERMELHO
    # --------------------------------------------------------

    {
        "lat": -23.55,
        "lon": -46.82,
        "classificacao": "alta"
    },

    # --------------------------------------------------------
    # PONTO AMARELO
    # --------------------------------------------------------

    {
        "lat": -23.57,
        "lon": -46.78,
        "classificacao": "media"
    },

    # --------------------------------------------------------
    # PONTO VERDE
    # --------------------------------------------------------

    {
        "lat": -23.59,
        "lon": -46.74,
        "classificacao": "baixa"
    }
]

# ============================================================
# 12. DESENHAR OS PONTOS NO MAPA
# ============================================================
#
# Cada ponto:
#
# ✔ recebe uma cor
# ✔ recebe um popup
# ✔ é desenhado no mapa
#
# ============================================================

for ponto in pontos_teste:

    classificacao = ponto["classificacao"]

    cor = definir_cor(classificacao)

    folium.CircleMarker(

        # Coordenadas
        location=[ponto["lat"], ponto["lon"]],

        # Tamanho do ponto
        radius=15,

        # Cor da borda
        color=cor,

        # Preencher círculo
        fill=True,

        # Cor interna
        fill_color=cor,

        # Transparência
        fill_opacity=0.7,

        # Popup ao clicar
        popup=f"""
        Classificação: {classificacao}
        """

    ).add_to(mapa)

# ============================================================
# 13. CONTROLE DE CAMADAS
# ============================================================
#
# Adiciona botão de controle no canto do mapa.
#
# ============================================================

folium.LayerControl(
    collapsed=False
).add_to(mapa)

# ============================================================
# FERRAMENTA DE DESENHO MANUAL
# ============================================================
#
# Permite desenhar no mapa:
#
# ✔ pontos
# ✔ linhas
# ✔ polígonos
# ✔ marcações
#
# Ideal para:
#
# - testes
# - apresentações
# - simulações
#
# ============================================================

Draw(

    export=True,

    filename="anotacoes_mapa.geojson",

    position="topleft",

    draw_options={

        # ----------------------------------------------------
        # LINHAS
        # ----------------------------------------------------

        "polyline": {
    "shapeOptions": {
        "color": "red",
        "weight": 12,
        "opacity": 0.7,
        "smoothFactor": 2
    }
},

        # ----------------------------------------------------
        # POLÍGONOS
        # ----------------------------------------------------

        "polygon": {
            "shapeOptions": {
                "color": "orange",
                "fillColor": "orange",
                "fillOpacity": 0.5
            }
        },

        # ----------------------------------------------------
        # CÍRCULOS
        # ----------------------------------------------------

        "circle": {
            "shapeOptions": {
                "color": "yellow",
                "fillColor": "yellow",
                "fillOpacity": 0.4
            }
        },

        # ----------------------------------------------------
        # RETÂNGULOS
        # ----------------------------------------------------

        "rectangle": {
            "shapeOptions": {
                "color": "green",
                "fillColor": "green",
                "fillOpacity": 0.3
            }
        },

        # ----------------------------------------------------
        # MARCADORES
        # ----------------------------------------------------

        "marker": True

    },

    edit_options={
        "edit": True
    }

).add_to(mapa)


# ============================================================
# 14. SALVAR MAPA
# ============================================================
#
# Gera arquivo HTML interativo.
#
# Basta abrir no navegador.
#
# ============================================================

mapa.save("mapa_rodovias.html")

# ============================================================
# 15. MENSAGEM FINAL
# ============================================================

print("Mapa gerado com sucesso!")
print("Arquivo salvo como: mapa_rodovias.html")