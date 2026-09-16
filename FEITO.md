# FEITO

Registro do que foi executado a partir de `afazer.md`.

## Contexto levantado antes de alterar

- O front (`dashboard_figma/src/app/App.tsx`, componente `ImagesTab`) fazia upload de
  imagens e tentava ler GPS do EXIF via `exifr.gps(file)`.
- Quando o EXIF não tinha GPS (praticamente sempre, já que são imagens de teste), o
  código caía num fallback mockado: `FALLBACK_LATITUDE`/`FALLBACK_LONGITUDE`
  (região metropolitana de SP) somados a um jitter aleatório (`comJitter`,
  `FALLBACK_JITTER_DEGREES`). Essa é a "função mockada com dado aleatório" citada
  no `afazer.md`.
- O backend (`backend/app/main.py`, endpoint `POST /api/v1/inspections`) apenas
  recebe `lat`/`lon` já prontos no payload e persiste — não precisou de alteração,
  pois a geração de coordenadas sempre foi responsabilidade do front.
- O tipo `Alert` (`types.ts`) já tinha um campo `rodovia?: string` não utilizado em
  lugar nenhum — reaproveitado agora.
- O `MapView.tsx` já plota qualquer `latitude`/`longitude` recebida via `alerts`,
  sem exigir mudança para exibir os novos pontos.

## Alterações feitas

### `dashboard_figma/src/app/types.ts`
- Adicionado `rodovia?: string` em `ImageEntry` (para exibir/persistir a rodovia
  escolhida também na galeria de imagens, não só no alerta).

### `dashboard_figma/src/app/App.tsx`
- Removido `import exifr from "exifr"` e toda a leitura de GPS via EXIF.
- Removidos `FALLBACK_LATITUDE`, `FALLBACK_LONGITUDE`, `FALLBACK_JITTER_DEGREES` e
  `comJitter`.
- Adicionada a lista `ROAD_LOCATIONS` com as 4 opções pedidas e suas faixas de
  latitude/longitude (conforme tabelas do `afazer.md`):
  - Presidente Dutra — lat `[-23.55, -22.80]`, lon `[-46.65, -43.20]`
  - Rodoanel Mário Covas — lat `[-23.85, -23.30]`, lon `[-46.95, -46.25]`
  - Rodovia dos Bandeirantes — lat `[-23.25, -22.65]`, lon `[-47.35, -46.55]`
  - Rodovia Anhanguera — lat `[-23.55, -20.15]`, lon `[-47.00, -47.70]`
- Adicionada `coordenadaAleatoriaNoIntervalo(a, b)`, que sorteia um valor dentro do
  intervalo independentemente da ordem dos limites informados (a tabela da
  Anhanguera tem a longitude "mínima" maior que a "máxima").
- `ImagesTab` agora abre um popup (`LocationPickerModal`) tanto ao clicar na zona
  de upload quanto ao soltar arquivos (drag & drop), **antes** de processar
  qualquer imagem:
  - Clique na dropzone → abre o popup → ao escolher uma rodovia, o seletor de
    arquivos do sistema é aberto.
  - Drop de arquivos → abre o popup com os arquivos já em mãos → ao escolher a
    rodovia, os arquivos são processados direto.
  - Popup pode ser fechado (X, clique fora, ou Esc) sem subir nada.
- `loadFiles(files, location)` passou a receber a rodovia escolhida e gerar
  `latitude`/`longitude` aleatórios dentro da faixa daquela rodovia para cada
  imagem do lote, em vez de tentar EXIF/fallback.
- A rodovia escolhida é salva em `registroImagem.rodovia` (localStorage),
  refletida no estado `images` (`img.rodovia`) e propagada para o alerta criado
  (`novoAlerta.rodovia`), além de compor o texto `location` do alerta
  (`"<Rodovia> — Imagem IMG-000123"`).
- `carregarImagensSalvas` passou a repopular `rodovia` ao recarregar do
  localStorage.
- Cada card da galeria de imagens agora mostra a rodovia escolhida acima das
  coordenadas.
- Texto de instrução da dropzone atualizado: trocado "a imagem precisa conter
  GPS nos metadados EXIF" por "você escolherá a rodovia da imagem em seguida".
- Mensagens de erro genéricas ajustadas (não citam mais "EXIF", já que essa etapa
  não existe mais).

## Atualização — `afazer.md` revisado (pontos fixos por rodovia)

O `afazer.md` foi atualizado pelo usuário: em vez de faixas de min/máx por
rodovia, a tabela agora traz um ponto exato (lat/lon) de referência por rodovia,
e pediu rebuild do docker compose ao final.

### `dashboard_figma/src/app/App.tsx`
- `RoadLocation` deixou de ter `latRange`/`lonRange` e passou a ter
  `latitude`, `longitude` e `reference` (referência textual do local).
- `ROAD_LOCATIONS` atualizado com os pontos exatos da nova tabela:
  - Presidente Dutra (BR-116) — `-23.2235, -45.9005` (São José dos Campos)
  - Rodoanel Mário Covas (SP-021) — `-23.5460, -46.8350` (Trecho oeste)
  - Rodovia dos Bandeirantes (SP-348) — `-23.1850, -46.8840` (Região de Jundiaí)
  - Rodovia Anhanguera (SP-330) — `-23.1800, -46.8700` (Região de Jundiaí)
- Removida `coordenadaAleatoriaNoIntervalo` (não sorteia mais nada — a imagem é
  marcada exatamente no ponto da rodovia escolhida, conforme pedido).
- `loadFiles` agora usa `location.latitude`/`location.longitude` diretamente.
- O popup de seleção (`LocationPickerModal`) passou a exibir também a
  referência de cada rodovia (ex.: "São José dos Campos") abaixo do nome, para
  ajudar na escolha.

### Rebuild do docker compose
- Rodado `docker compose up -d --build frontend` (único serviço afetado pela
  mudança). Build do Vite/TypeScript concluído sem erros (2263 módulos
  transformados). Containers `db`, `backend` e `frontend` confirmados de pé via
  `docker compose ps`. Aplicação disponível em `http://localhost:8080`.

## Atualização — imagens caindo em cima do traçado real da rodovia

Pedido do usuário: as imagens deveriam aparecer dentro das coordenadas que já
existem nos mapas, **em cima das linhas das rodovias** (o ponto fixo por
rodovia usado até então não garantia isso — era só um ponto de referência
aproximado, podendo cair fora da linha desenhada pelo `MapView`).

### Investigação
- `MapView.tsx` desenha 3 camadas a partir de GeoJSON servidos em
  `dashboard_figma/public/geojson/`: `via_dutra.geojson` (LineStrings, com
  `sg_uf` SP/RJ), `autoban.geojson` (4 LineStrings, um por rodovia, com a
  propriedade `rodovia`: `SP-300`, `SP-348` = Bandeirantes, `SPI-102/330`,
  `SP-330` = Anhanguera) e `rodoanel_rocada.geojson` (642 Polygons pequenos —
  trechos de classificação de vegetação ao longo do Rodoanel Mário Covas,
  concentrados entre lat `-23.63/-23.41` e lon `-46.83/-46.73`).
- Ou seja, os próprios arquivos que desenham as linhas no mapa já têm os
  pontos exatos do traçado — bastava reaproveitá-los para sortear a
  coordenada de cada imagem, em vez de usar um ponto fixo único.

### `dashboard_figma/src/app/App.tsx`
- Adicionado `ROAD_GEOJSON_FILES`: mapeia cada `RoadLocation.id` para o mesmo
  arquivo GeoJSON usado no `MapView` (Bandeirantes e Anhanguera compartilham
  `autoban.geojson`, filtrados depois pela propriedade `rodovia`).
- Adicionada `extrairPontosDaRodovia(roadId, geojson)`: dado o GeoJSON já
  carregado, devolve a lista de pontos `[lon, lat]` pertencentes àquela
  rodovia —
  - Presidente Dutra: todos os vértices das features de `via_dutra.geojson`
    com `sg_uf === "SP"`;
  - Rodoanel Mário Covas: o centróide (`centroideDoAnel`) de cada polígono de
    `rodoanel_rocada.geojson`;
  - Bandeirantes/Anhanguera: os vértices da feature de `autoban.geojson` cuja
    `rodovia` é `SP-348`/`SP-330`, respectivamente.
- Adicionada `sortearCoordenadaDaRodovia(location, pontos)`: sorteia um ponto
  aleatório dentre os pontos reais da rodovia; se o GeoJSON ainda não carregou
  ou não há pontos, cai no ponto fixo de `ROAD_LOCATIONS` como fallback (os
  pontos fixos adicionados na etapa anterior viraram apenas esse fallback).
- Em `ImagesTab`, um novo `useEffect` (roda uma vez ao montar) busca os 3
  arquivos GeoJSON em paralelo e preenche `roadPointsRef.current` — um `ref`
  (não `state`) para não precisar recriar `loadFiles` a cada atualização.
- `loadFiles` agora chama `sortearCoordenadaDaRodovia(location,
  roadPointsRef.current[location.id])` em vez de usar
  `location.latitude`/`location.longitude` fixos — cada imagem cai num ponto
  real do traçado da rodovia escolhida, dentro da linha exibida no mapa.

### Rebuild do docker compose
- Rodado `docker compose up -d --build frontend` novamente. Build do
  Vite/TypeScript sem erros. Confirmado via `curl` que os 3 GeoJSON
  (`via_dutra.geojson`, `rodoanel_rocada.geojson`, `autoban.geojson`) são
  servidos com `200` pelo nginx do container em `http://localhost:8080`.

## Não alterado (fora do escopo)

- Backend (`backend/app/*`): não precisou de mudança, já aceitava lat/lon prontos.
- `MapView.tsx`: já desenha qualquer alerta com `latitude`/`longitude` válidos.
- Dependência `exifr` continua no `package.json` do `dashboard_figma`, apenas
  deixou de ser usada em `App.tsx` (não removida do `package.json` para não mexer
  em dependências sem necessidade).

## Verificação

- Não foi possível rodar `npm run typecheck` / `npm run dev` neste ambiente
  (Node.js/npm não estão instalados no shell usado pela sessão). O código foi
  revisado manualmente linha a linha após cada edição para garantir consistência
  de tipos e fechamento de JSX.
- Recomendado rodar manualmente, dentro de `dashboard_figma`:
  - `npm install` (se necessário)
  - `npm run typecheck`
  - `npm run dev` e testar: clicar na zona de upload → popup aparece → escolher
    uma rodovia → selecionar imagem → verificar que o marcador aparece no mapa
    dentro da região da rodovia escolhida. Repetir testando drag & drop.
