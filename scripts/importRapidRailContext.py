"""
Server-side importer for the official data.gov.my Rapid Rail OD parquet file.

This is deliberately not a browser task and it imports no station mappings by
default. Supply a reviewed CSV with exactly these headers:
  canonical_location_key,location_name,station_name

The output measures rail trips linked to a reviewed station, not bazaar
footfall and not food demand. It is stored only as a contextual observation.

Requirements (in an isolated import environment):
  pip install pandas pyarrow

Usage:
  SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
    python scripts/importRapidRailContext.py reviewed_location_station_links.csv
"""

from __future__ import annotations

import csv
import json
import os
import sys
import urllib.request
from datetime import datetime, timezone

import pandas as pd

CATALOGUE_URL = "https://data.gov.my/data-catalogue/ridership_od_rapidrail_daily"
DEFAULT_PARQUET_URL = "https://storage.data.gov.my/transportation/rail/rapidrail_2026_daily.parquet"
SOURCE_KEY = "data_gov_my_rapidrail_daily_od"


def require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"{name} is required")
    return value


def postgrest(url: str, service_key: str, path: str, payload, prefer: str) -> list[dict]:
    request = urllib.request.Request(
        f"{url.rstrip('/')}/rest/v1/{path}",
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
        headers={
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
            "Prefer": prefer,
        },
    )
    with urllib.request.urlopen(request) as response:
        body = response.read().decode("utf-8")
        return json.loads(body) if body else []


def read_links(filename: str) -> list[dict[str, str]]:
    with open(filename, newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    required = {"canonical_location_key", "location_name", "station_name"}
    if not rows or not required.issubset(rows[0]):
        raise RuntimeError("Reviewed links CSV must contain canonical_location_key, location_name, station_name")
    cleaned = []
    for row in rows:
        clean = {key: (row.get(key) or "").strip() for key in required}
        if not all(clean.values()):
            raise RuntimeError("Every reviewed location-to-station mapping must have all required fields")
        cleaned.append(clean)
    return cleaned


def main() -> None:
    if len(sys.argv) != 2:
        raise RuntimeError("Pass the path to a reviewed location-to-station CSV")
    supabase_url = require_env("SUPABASE_URL")
    service_key = require_env("SUPABASE_SERVICE_ROLE_KEY")
    links = read_links(sys.argv[1])
    parquet_url = os.environ.get("RAPID_RAIL_PARQUET_URL", DEFAULT_PARQUET_URL)

    # The official catalogue explicitly recommends parquet/programmatic use for
    # this dataset because yearly CSVs exceed spreadsheet row limits.
    data = pd.read_parquet(parquet_url, columns=["date", "origin", "destination", "ridership"])
    data["date"] = pd.to_datetime(data["date"]).dt.strftime("%Y-%m-%d")
    data["ridership"] = pd.to_numeric(data["ridership"], errors="coerce")
    data = data.dropna(subset=["date", "origin", "destination", "ridership"])

    retrieved_at = datetime.now(timezone.utc).isoformat()
    source_rows = postgrest(
        supabase_url,
        service_key,
        "data_sources?on_conflict=source_key",
        {
            "source_key": SOURCE_KEY,
            "name": "data.gov.my Daily Origin-Destination Ridership: Rapid Rail (Klang Valley)",
            "publisher": "Prasarana Malaysia / Ministry of Transport via data.gov.my",
            "source_url": CATALOGUE_URL,
            "license": "CC BY 4.0",
            "source_type": "contextual_feature",
            "validation_status": "validated",
            "retrieved_at": retrieved_at,
            "notes": {
                "what_it_measures": "Daily origin-destination rail trips from Rapid tap-in/tap-out data. It is a mobility/activity proxy, not bazaar footfall and not food demand.",
                "source_file": parquet_url,
                "ingestion": "Programmatic parquet import via scripts/importRapidRailContext.py",
            },
        },
        "resolution=merge-duplicates,return=representation",
    )
    if not source_rows:
        raise RuntimeError("Could not create or retrieve the Rapid Rail data source")
    source_id = source_rows[0]["id"]

    station_links = [
        {
            **link,
            "source_id": source_id,
            "validation_status": "validated",
            "notes": "Imported from a reviewed explicit mapping file; no distance heuristic was used.",
        }
        for link in links
    ]
    postgrest(supabase_url, service_key, "public_location_station_links?on_conflict=canonical_location_key", station_links, "resolution=merge-duplicates")

    observations = []
    for link in links:
        # A trip is counted once if the reviewed station is either its origin or
        # destination. This deliberately does not call it a visitor count.
        station_rows = data[(data["origin"] == link["station_name"]) | (data["destination"] == link["station_name"])]
        grouped = station_rows.groupby("date", as_index=False)["ridership"].sum()
        observations.extend(
            {
                "source_id": source_id,
                "observation_date": str(row.date),
                "canonical_location_key": link["canonical_location_key"],
                "signal_type": "rapid_rail_od_trips",
                "numeric_value": float(row.ridership),
                "unit": "trips",
                "metadata": {
                    "station_name": link["station_name"],
                    "methodology": "Sum of official OD trips where the reviewed station is origin or destination; contextual mobility proxy only.",
                },
            }
            for row in grouped.itertuples(index=False)
        )

    batch_size = 1000
    for offset in range(0, len(observations), batch_size):
        postgrest(
            supabase_url,
            service_key,
            "public_context_observations?on_conflict=source_id,observation_date,canonical_location_key,signal_type",
            observations[offset : offset + batch_size],
            "resolution=merge-duplicates",
        )
    print(f"Imported {len(observations)} contextual Rapid Rail observations for {len(links)} reviewed mapping(s).")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:  # explicit import failure is safer than partial guessed data
        print(str(error), file=sys.stderr)
        sys.exit(1)
