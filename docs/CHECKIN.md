# Daily check-in and historical data

The completed-session flow is:

```text
Selling plan → demand estimate → selling result → completed plan → future historical baseline
```

The Profile page contains the daily check-in for a selected selling session. It records the confirmed/corrected location, prepared quantity, leftovers, unit, calculated non-negative `estimated_sold_quantity`, and crowd level. Saving uses an upsert keyed by `user_id,selling_plan_id`, so refreshes and retries update the same record instead of adding duplicates.

The small additive migration at `supabase/migrations/20260912000000_daily_checkin_integrity.sql` must be applied before deployment. It adds `estimated_sold_quantity`, creates the unique index required by the upsert, and enables a user-owned RLS policy for daily check-ins.

`getHistoricalSessions()` now reads only the current user’s completed plans and their own check-ins. A plan is marked `completed` after a successful check-in, allowing it to become a comparable session for the next forecast.

Run `npm run test:checkin` to verify validation, calculated sales, idempotent persistence, and the completed-plan update with a mocked Supabase client.

Run `npm run test:history-feed` to verify that a completed, user-owned check-in is transformed into the historical session consumed by the forecast engine.
