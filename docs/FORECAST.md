# Explainable demand estimate

`src/services/forecast/forecastEngine.ts` is the only component that calculates a numerical demand estimate. It never calls an LLM for a quantity.

## Numerical evidence hierarchy

1. Compatible private seller check-ins.
2. A future validated public dataset containing comparable, per-session units-sold observations.
3. No numerical estimate.

For a completed single-food session:

```text
estimated sold = max(0, prepared quantity - leftover quantity)
baseline = mean of comparable estimated sold quantities
range = empirical interquartile range of those quantities
```

Comparable records prioritise the same food and measurement unit, then matching location, day of week, and selling time. A generic onboarding unit such as `serving` adopts the most frequently recorded check-in unit for that food instead of silently discarding valid history.

Weather, events, holidays, price references, and public market context never change the quantity unless a future labelled, held-out model validates that relationship.

## Public market context

The DOSM Ramadan and Aidilfitri Bazaar release stores bazaar-level stalls, persons engaged, and sales value by state/district. It is retained with source provenance in `data_sources` and `public_bazaar_benchmarks`, but it is **not** converted to food-item or per-session units sold.

The current imported DOSM data therefore explains market context only. It cannot produce a preparation quantity for a new seller. A future public numerical fallback must contain actual, compatible per-session units-sold labels and a range/sample size.

## Resilience and persistence

Unavailable providers produce concise seller-facing fallback states and developer console diagnostics. They do not stop a history-based estimate.

- `recommendations` stores a numerical recommendation only when one exists.
- `external_signals` stores plan-scoped structured forecast signals using `selling_plan_id`.
- `forecast_evidence_snapshots` retains the source/methodology shown for a plan.
- Low-data flows save an evidence summary but never write a zero-valued recommendation.

## Verification

```text
npm.cmd run test:forecast
npm.cmd run test:forecast:persistence
npm.cmd run test:external-data
npm.cmd run test:checkin
npm.cmd run test:history-feed
```
