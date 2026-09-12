# Bazaar Buddy

Mobile-first selling-plan, check-in, and demand-estimation MVP for Malaysian food vendors.

## Public-data forecast design

The numerical target is **expected food demand / units sold**, not crowd or footfall. An LLM is never asked to create a number.

The current estimator has three evidence paths:

- **Private seller evidence** — user-scoped completed check-ins calculate `prepared_quantity - leftover_quantity`. Comparable records produce an empirical mean and empirical interquartile range.
- **Validated public benchmark** — the DOSM Ramadan and Aidilfitri Bazaar workbook provides sales value, stalls, and persons engaged by state/district. It is stored as a market-level benchmark, never as item-level units sold. When a real per-serving price exists, the UI may show an explicitly labelled revenue-equivalent benchmark for the published bazaar period.
- **Insufficient evidence** — no quantity is invented when neither compatible personal observations nor a convertible public benchmark exists.

Weather, events, official holidays, and Rapid Rail activity are context-only. They do not modify quantity until a labelled, time-split, evaluated demand model demonstrates a valid relationship. Rapid Rail records are explicitly labelled mobility/activity proxy, not bazaar footfall.

## Public source ingestion

Apply the Supabase migrations first, then run the importer with a **server-only** service role key:

```powershell
npm.cmd install
npx supabase db push
$env:SUPABASE_URL = 'https://your-project.supabase.co'
$env:SUPABASE_SERVICE_ROLE_KEY = 'your-service-role-key'
npm.cmd run import:public-data
```

The importer downloads and parser-validates:

- [DOSM Statistics on Ramadan and Aidilfitri Bazaars Malaysia 2025](https://www.dosm.gov.my/portal-main/release-content/statistics-on-ramadan-and-aidilfitri-bazaars-malaysia-2025)
- [DOSM Average Prices of Selected Bazaar Items 2026](https://www.dosm.gov.my/uploads/content-downloads/file_20260406092417.pdf)

It records source URL, publisher, coverage, retrieval date, source role, and what each source actually measures in `data_sources`. It imports 2022/2023/2025 benchmark rows from the official workbook and only accepts the price PDF when all 20 selected Ramadan items are parser-validated.

To validate local source files without writing to Supabase:

```powershell
npm.cmd run validate:public-data -- path\to\dosm_bazaar.xlsx path\to\dosm_prices.pdf
```

### Optional Rapid Rail context

`scripts/importRapidRailContext.py` is intentionally server-side and requires `pandas` and `pyarrow`. It reads the official [data.gov.my Rapid Rail OD dataset](https://data.gov.my/data-catalogue/ridership_od_rapidrail_daily), plus a reviewed `canonical_location_key,location_name,station_name` mapping file. Without that defensible mapping, no transit record is imported or used.

## Local development

```powershell
Copy-Item .env.example .env
# Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env
npm.cmd run dev
```

Optional client/server gateway variables are documented in `.env.example`. No provider key is required for Open-Meteo.

## Verification

```powershell
npm.cmd run test:forecast
npm.cmd run test:forecast:persistence
npm.cmd run test:external-data
npm.cmd run test:checkin
npm.cmd run test:history-feed
npm.cmd run lint
npm.cmd run build
```

Future supervised models belong in `model_versions` and must use labelled demand observations, time-based held-out validation, MAE/RMSE, and a simple-baseline comparison before deployment.
