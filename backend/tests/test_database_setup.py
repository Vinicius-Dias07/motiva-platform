from app.database_setup import EXPECTED_COLUMNS, validate_schema


def test_schema_validator_accepts_expected_tables() -> None:
    assert validate_schema({name: set(columns) for name, columns in EXPECTED_COLUMNS.items()}) == []


def test_schema_validator_reports_missing_table_and_column() -> None:
    schema = {"inspections": EXPECTED_COLUMNS["inspections"] - {"confidence"}}

    errors = validate_schema(schema)

    assert "Colunas ausentes em public.inspections: confidence" in errors
    assert "Tabela ausente: public.detections" in errors
