// ============================================================
// Shared hardcoded presentation data for the MVP demo screens.
// This module does not calculate or persist production metrics.
// ============================================================

export const DEMO_METRICS = {
  preparationRange: {
    minimum: 112,
    maximum: 128,
    unit: 'portions',
  },
  potentialSavings: 184,
  pastForecastAccuracy: 87,
  potentialWasteAvoidedKg: 1.8,
  sustainability: {
    current: 100,
    goal: 100,
  },
} as const;

// The dashboard deliberately uses fixed presentation context while the MVP
// layout is being reviewed. It is not a live weather lookup and must remain
// labelled as demo data until a real forecast is wired into this screen.
export const DEMO_WEATHER_CONTEXT = {
  fallbackLocation: 'your bazaar',
  condition: 'Clear & warm',
  temperature: '31°C',
  rainChance: '20%',
} as const;

export const hasDemoSustainabilityBadge = DEMO_METRICS.sustainability.current >= DEMO_METRICS.sustainability.goal;

export function getDemoSustainabilityProgress(): number {
  return Math.min(100, Math.round((DEMO_METRICS.sustainability.current / DEMO_METRICS.sustainability.goal) * 100));
}
