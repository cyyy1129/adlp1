# Bleu

Mobile-first selling-plan, check-in, and evidence-based demand-estimation MVP for Malaysian food vendors.

## Demand estimate design

The numerical target is expected food demand / units sold, not literal crowd or footfall. An LLM is never asked to generate a number.

The current evidence hierarchy is:

- **Seller history** — completed, single-food check-ins calculate `prepared_quantity - leftover_quantity`. Compatible sessions provide an empirical mean and interquartile range.
- **Future validated public session data** — supported only when a source contains compatible per-session units-sold observations, including a real sample size and range.
- **Insufficient evidence** — the app shows no quantity instead of inventing one.

Official DOSM bazaar statistics are imported as traceable market context: they measure bazaar-level stalls, persons engaged, and sales value. They are not item-level sales labels and are never divided by a price to manufacture a preparation quantity. Weather, events, holidays, and price data are context-only until a labelled, evaluated model supports using them numerically.

## Public source ingestion

Apply the Supabase migrations first, then run the importer with a server-only service role key:

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

It records source URL, publisher, coverage, retrieval date, source role, and what each source actually measures in `data_sources`.

To validate local source files without writing to Supabase:

```powershell
npm.cmd run validate:public-data -- path\to\dosm_bazaar.xlsx path\to\dosm_prices.pdf
```

## Local development

```powershell
Copy-Item .env.example .env
# Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env
npm.cmd run dev
```

Open-Meteo requires no key. Verified event and official-holiday sources are optional server-side gateways configured with `VITE_EVENTS_API_ENDPOINT` and `VITE_OFFICIAL_HOLIDAYS_API_ENDPOINT` respectively.

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

Any future supervised model must use labelled demand observations, a time-based held-out validation split, MAE/RMSE, and a simple-baseline comparison before deployment.
