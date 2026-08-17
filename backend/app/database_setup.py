import argparse
from pathlib import Path

import psycopg

from .config import get_settings

EXPECTED_COLUMNS = {
    "inspections": {"id", "latitude", "longitude", "status", "confidence", "created_at"},
    "detections": {
        "id",
        "inspection_id",
        "class_name",
        "confidence",
        "x",
        "y",
        "width",
        "height",
    },
}
MIGRATION_PATH = (
    Path(__file__).resolve().parents[2] / "database" / "migrations" / "001_initial_schema.sql"
)


def read_schema(connection: psycopg.Connection) -> dict[str, set[str]]:
    rows = connection.execute(
        """
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name IN ('inspections', 'detections')
        """
    ).fetchall()
    schema: dict[str, set[str]] = {}
    for table_name, column_name in rows:
        schema.setdefault(str(table_name), set()).add(str(column_name))
    return schema


def validate_schema(schema: dict[str, set[str]]) -> list[str]:
    errors: list[str] = []
    for table_name, expected in EXPECTED_COLUMNS.items():
        actual = schema.get(table_name)
        if actual is None:
            errors.append(f"Tabela ausente: public.{table_name}")
            continue
        missing = expected - actual
        if missing:
            errors.append(f"Colunas ausentes em public.{table_name}: {', '.join(sorted(missing))}")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Valida ou aplica somente a migration inicial da Motiva Platform."
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Aplica 001_initial_schema.sql apenas quando as duas tabelas estiverem ausentes.",
    )
    args = parser.parse_args()

    database_url = get_settings().database_url
    if not database_url:
        print("DATABASE_URL não configurada em backend/.env")
        return 2

    with psycopg.connect(database_url) as connection:
        schema = read_schema(connection)
        if not schema and args.apply:
            migration_sql = MIGRATION_PATH.read_text(encoding="utf-8")
            connection.execute(migration_sql)
            schema = read_schema(connection)
            print("Migration 001 aplicada; o seed de demonstração não foi executado.")
        elif args.apply and set(schema) != set(EXPECTED_COLUMNS):
            print(
                "Schema parcial encontrado; aplicação automática recusada para preservar os dados."
            )
            return 1

        errors = validate_schema(schema)
        if errors:
            for error in errors:
                print(error)
            return 1

    print("Schema public.inspections/public.detections compatível.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
