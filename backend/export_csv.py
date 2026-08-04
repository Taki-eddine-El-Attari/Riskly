"""Exporte toutes les tables de la base (schéma public) en fichiers CSV.

Usage:
    python export_csv.py [dossier_de_sortie]

Dossier de sortie par défaut : ./exports/
"""

import csv
import sys
from pathlib import Path

from sqlalchemy import MetaData, create_engine, select

from app.core.config import settings

output_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent / "exports"
output_dir.mkdir(parents=True, exist_ok=True)

engine = create_engine(settings.DATABASE_URL)
metadata = MetaData()
metadata.reflect(bind=engine, schema="public")

if not metadata.tables:
    print("Aucune table trouvée dans le schéma public.")
    sys.exit(0)

with engine.connect() as conn:
    for table in metadata.tables.values():
        result = conn.execute(select(table))
        columns = list(result.keys())
        csv_path = output_dir / f"{table.name}.csv"

        with open(csv_path, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.writer(f)
            writer.writerow(columns)
            row_count = 0
            for row in result:
                writer.writerow(row)
                row_count += 1

        print(f"{table.name}: {row_count} lignes -> {csv_path}")

print(f"\nExport terminé dans {output_dir}")
