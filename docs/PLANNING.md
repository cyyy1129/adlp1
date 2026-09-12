# Selling planning flow

The authenticated dashboard is the main planning page. It collects one selling session in this order:

`ASK_SCHEDULE → CONFIRM_SCHEDULE → ASK_LOCATION → CONFIRM_LOCATION → ASK_FOOD → CONFIRM_FOOD → PLAN_READY`

Each confirmation is local-only. The app writes to Supabase only when the seller presses **Save selling plan** from the final summary.

## AI configuration

The app works without AI credentials. In that case it uses the deterministic local extractor in `src/services/ai/extraction.ts`.

To use a hosted AI implementation, set `VITE_AI_EXTRACTION_ENDPOINT` to a server-side extraction gateway. The gateway receives a JSON `planning_extraction` request and must return this shape:

```json
{
  "data": {},
  "missing": [],
  "error": null
}
```

Provider secrets must stay in that server-side gateway; no provider key is embedded in the browser app. Invalid or unavailable responses automatically fall back to the local extractor and tell the seller to review the confirmation.

## Verification checklist

1. Type `This Saturday from 5pm to 10pm`; verify the date/time confirmation before proceeding.
2. Use the microphone where Web Speech is supported; verify the transcript appears as a user message and leads to the same confirmation.
3. Choose **Edit / try again** after a spoken response; verify nothing has been saved and a new recording or typed response is accepted.
4. Re-record a response; verify only the newly confirmed value advances the flow.
5. Confirm the schedule, location, and food cards; verify each value appears in the final summary.
6. Type a stall/place name without coordinates; verify location confirmation accepts it.
7. Select an onboarding food choice; verify a custom-food input is only needed for a different food.
8. With configured Supabase and an authenticated account, save the final plan; verify one `selling_plans` row and its related `selling_items` row are created.
9. Leave `VITE_AI_EXTRACTION_ENDPOINT` unset; verify typed planning still works through the local extractor.
10. Point that endpoint at an unavailable service; verify the warning appears and the local extractor keeps the workflow usable.
