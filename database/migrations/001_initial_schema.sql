-- Schema inicial esperado por backend/app/database_setup.py (EXPECTED_COLUMNS).
-- status aceita os valores produzidos por app/domain.py (CLASSIFICATION_TO_STATUS).

CREATE TABLE IF NOT EXISTS public.inspections (
    id BIGSERIAL PRIMARY KEY,
    latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    status TEXT NOT NULL CHECK (status IN ('OK', 'ATENÇÃO', 'URGENTE')),
    confidence DOUBLE PRECISION NOT NULL CHECK (confidence BETWEEN 0 AND 1),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.detections (
    id BIGSERIAL PRIMARY KEY,
    inspection_id BIGINT NOT NULL REFERENCES public.inspections (id) ON DELETE CASCADE,
    class_name TEXT NOT NULL,
    confidence DOUBLE PRECISION NOT NULL CHECK (confidence BETWEEN 0 AND 1),
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    width INTEGER NOT NULL CHECK (width >= 0),
    height INTEGER NOT NULL CHECK (height >= 0)
);

CREATE INDEX IF NOT EXISTS idx_detections_inspection_id ON public.detections (inspection_id);
CREATE INDEX IF NOT EXISTS idx_inspections_created_at ON public.inspections (created_at DESC);
