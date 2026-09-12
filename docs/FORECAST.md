# Explainable demand estimate

The numerical estimate is generated only by `src/services/forecast/forecastEngine.ts`. It uses completed single-food sessions and calculates estimated sales as:

```text
estimated sold = prepared quantity - leftover quantity
baseline = average comparable estimated sales
forecast = baseline × (1 + configured adjustments)
```

Comparable sessions prioritise the same food, then the same location and day of week, and are limited to the most recent configured records. The initial adjustment values live together in `src/services/forecast/signalWeights.ts`.

The engine does not call an LLM and no provider can generate quantities, ranges, baselines, or numerical explanations.

## Low-data behaviour

When there is no completed history for the selected food, the result is explicitly Low confidence and does not show a made-up preparation quantity. Available day, weather, and event signals are still displayed, but the product explains that a numeric recommendation is not grounded yet.

## External data

All provider failures resolve to an explicit unavailable state and the deterministic engine continues with only the data it has. No unavailable source is replaced with sample data.

### Weather — Open-Meteo

`src/services/weather/weatherService.ts` calls the keyless Open-Meteo Forecast API for the selling plan's latitude, longitude, date, and session time. It requests and stores the following normalized values:

- `temperature_c`
- `precipitation_probability`
- `precipitation_mm`
- `weather_code`

The app aggregates hourly values over the selling window (average temperature, highest rain probability, total precipitation) and uses the returned values to classify the configured weather signal. A plan without map coordinates, an out-of-range date, or a network/API failure shows an unavailable state and applies no weather adjustment.

### Nearby events

There is no stable, documented Malaysia-wide event-search API suitable for direct browser use. `VITE_EVENTS_API_ENDPOINT` is therefore an optional server-side gateway for verified data from an appropriate source such as MyGovEvent or Tourism Malaysia. It receives:

```json
{
  "date": "2026-09-19",
  "start_time": "17:00",
  "end_time": "22:00",
  "latitude": 4.3,
  "longitude": 101.1,
  "location_name": "Kampar Night Market"
}
```

It must return only source records it actually found:

```json
{
  "events": [
    {
      "name": "Verified event name",
      "distance_km": 2.4,
      "starts_at": "2026-09-19T18:00:00+08:00",
      "source": "MyGovEvent",
      "source_url": "https://..."
    }
  ]
}
```

With no configured verified gateway, no result, or an error, the UI says `No nearby event data available.` and no event adjustment is applied. The app does not use the deprecated Eventbrite public search endpoint and does not scrape or invent events.

### Price insight — Malaysia PriceCatcher

`src/services/pricing/pricingService.ts` reads the official PriceCatcher item lookup and the recent section of its current transaction file on `data.gov.my`. It only displays a reference if the seller's food name has an exact item-lookup match and actual transaction rows are found. The result stores and shows the lookup item, unit, recent median transaction price, date, and observed sample size.

PriceCatcher is a consumer/market price reference. The UI explicitly says it is not a prepared-food selling price, and it never changes the demand calculation. If there is no exact official item match, no usable recent transaction data, or a request fails, the UI says `Price reference unavailable.`

## Persistence

The existing schema is used without a migration:

- Numeric estimates persist to `recommendations` using its existing `min_qty`, `max_qty`, `recommended_qty`, `confidence`, and `reasoning` columns.
- The baseline, full structured forecast, and every forecast input signal persist to `external_signals` with source `forecast_engine_v1`.
- Normalized `weather_observation`, `nearby_event_context`, and `price_reference` records are also stored in `external_signals` so the displayed provider facts can be explained later.
- When history is insufficient, no zero-valued recommendation is written; the explanatory forecast summary and signals still persist to `external_signals`.

## Verification

Run:

```text
npm run test:forecast
npm run test:forecast:persistence
npm run test:external-data
```

The checks cover many historical records, no history, unavailable weather/events/pricing, multiple sessions, different foods, different days, repeatability, Open-Meteo normalization and fallback, an empty actual event response, PriceCatcher data, and PriceCatcher's unavailable state. A live Supabase write still requires an authenticated account and real completed-session data.
