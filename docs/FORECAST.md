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

## Provider configuration

All provider endpoints are optional. A provider failure resolves to an explicit unavailable state and the engine continues with its remaining inputs.

| Environment variable | Purpose |
| --- | --- |
| `VITE_WEATHER_API_ENDPOINT` | Server-side weather gateway returning `condition`, `summary`, and optional `source`. |
| `VITE_USE_MOCK_WEATHER=true` | Enables clearly labelled development/demo weather only. |
| `VITE_MOCK_WEATHER_CONDITION` | Optional `rain`, `clear`, `hot`, or `other` mock condition. |
| `VITE_EVENTS_API_ENDPOINT` | Server-side event gateway returning verified `events`. |
| `VITE_PRICE_REFERENCE_ENDPOINT` | Verified price-reference gateway. This is never presented as an exact seller price. |

Provider secrets should remain in the server-side gateway rather than in browser code.

## Persistence

The existing schema is used without a migration:

- Numeric estimates persist to `recommendations` using its existing `min_qty`, `max_qty`, `recommended_qty`, `confidence`, and `reasoning` columns.
- The baseline, full structured forecast, and every input signal persist to `external_signals` with source `forecast_engine_v1`.
- When history is insufficient, no zero-valued recommendation is written; the explanatory forecast summary and signals still persist to `external_signals`.

## Verification

Run:

```text
npm run test:forecast
```

The check covers many historical records, no history, unavailable weather/events/pricing, multiple sessions, different foods, different days, and repeatability with identical inputs.

Run `npm run test:forecast:persistence` to verify the exact `recommendations` and `external_signals` write payloads against a mocked Supabase client. A live Supabase write still requires an authenticated account and real completed-session data.
