BEGIN;

-- =========================================================
-- Demo Seed - Motiva Platform
-- Creates sample inspections and detections
-- =========================================================


-- =========================================================
-- Remove previous demo data
-- Related detections are removed by ON DELETE CASCADE
-- =========================================================

DELETE FROM inspections
WHERE (latitude, longitude) IN (
    (-23.5510, -46.6340),
    (-23.5520, -46.6350),
    (-23.5530, -46.6360),
    (-23.5540, -46.6370),
    (-23.5550, -46.6380),
    (-23.5560, -46.6390),
    (-23.5570, -46.6400),
    (-23.5580, -46.6410),
    (-23.5590, -46.6420),
    (-23.5600, -46.6430)
);


-- =========================================================
-- Demo inspections
-- =========================================================

INSERT INTO inspections (
    latitude,
    longitude,
    status,
    confidence
)
VALUES
    (-23.5510, -46.6340, 'OK',       0.00),
    (-23.5520, -46.6350, 'ATENÇÃO',  0.52),
    (-23.5530, -46.6360, 'URGENTE',  0.88),
    (-23.5540, -46.6370, 'OK',       0.27),
    (-23.5550, -46.6380, 'ATENÇÃO',  0.61),
    (-23.5560, -46.6390, 'URGENTE',  0.91),
    (-23.5570, -46.6400, 'OK',       0.33),
    (-23.5580, -46.6410, 'ATENÇÃO',  0.47),
    (-23.5590, -46.6420, 'URGENTE',  0.76),
    (-23.5600, -46.6430, 'OK',       0.12);


-- =========================================================
-- Demo detections
-- =========================================================

-- ATENÇÃO
INSERT INTO detections (
    inspection_id,
    class_name,
    confidence,
    x,
    y,
    width,
    height
)
SELECT
    id,
    'vegetacao',
    0.52,
    140,
    90,
    260,
    180
FROM inspections
WHERE latitude = -23.5520
  AND longitude = -46.6350;


-- URGENTE
INSERT INTO detections (
    inspection_id,
    class_name,
    confidence,
    x,
    y,
    width,
    height
)
SELECT
    id,
    'vegetacao',
    0.88,
    120,
    80,
    300,
    220
FROM inspections
WHERE latitude = -23.5530
  AND longitude = -46.6360;


INSERT INTO detections (
    inspection_id,
    class_name,
    confidence,
    x,
    y,
    width,
    height
)
SELECT
    id,
    'vegetacao',
    0.81,
    480,
    110,
    210,
    240
FROM inspections
WHERE latitude = -23.5530
  AND longitude = -46.6360;


-- ATENÇÃO
INSERT INTO detections (
    inspection_id,
    class_name,
    confidence,
    x,
    y,
    width,
    height
)
SELECT
    id,
    'vegetacao',
    0.61,
    210,
    100,
    280,
    190
FROM inspections
WHERE latitude = -23.5550
  AND longitude = -46.6380;


-- URGENTE
INSERT INTO detections (
    inspection_id,
    class_name,
    confidence,
    x,
    y,
    width,
    height
)
SELECT
    id,
    'vegetacao',
    0.91,
    100,
    70,
    320,
    260
FROM inspections
WHERE latitude = -23.5560
  AND longitude = -46.6390;


INSERT INTO detections (
    inspection_id,
    class_name,
    confidence,
    x,
    y,
    width,
    height
)
SELECT
    id,
    'vegetacao',
    0.84,
    500,
    130,
    190,
    210
FROM inspections
WHERE latitude = -23.5560
  AND longitude = -46.6390;


-- ATENÇÃO
INSERT INTO detections (
    inspection_id,
    class_name,
    confidence,
    x,
    y,
    width,
    height
)
SELECT
    id,
    'vegetacao',
    0.47,
    175,
    105,
    230,
    170
FROM inspections
WHERE latitude = -23.5580
  AND longitude = -46.6410;


-- URGENTE
INSERT INTO detections (
    inspection_id,
    class_name,
    confidence,
    x,
    y,
    width,
    height
)
SELECT
    id,
    'vegetacao',
    0.76,
    130,
    75,
    310,
    215
FROM inspections
WHERE latitude = -23.5590
  AND longitude = -46.6420;


COMMIT;