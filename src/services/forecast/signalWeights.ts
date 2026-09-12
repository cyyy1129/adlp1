// ============================================================
// Initial transparent MVP weights. Keep all forecast tuning here.
// ============================================================

export const FORECAST_WEIGHTS = {
  weekend: 0.1,
  nearbyEvent: 0.1,
  weather: {
    rain: -0.1,
    clear: 0.03,
    hot: -0.04,
    other: 0,
  },
  historicalCrowd: {
    Quiet: -0.05,
    Normal: 0,
    Packed: 0.05,
  },
  strongHistoricalPerformance: 0.05,
  strongPerformanceRatio: 1.1,
  nearbyEventRadiusKm: 5,
  maximumAdjustment: 0.3,
  minimumAdjustment: -0.3,
  rangePercentage: 0.06,
  minimumRangeQuantity: 2,
  maxComparableSessions: 8,
} as const;

export const CONFIDENCE_THRESHOLDS = {
  mediumComparableRecords: 2,
  highComparableRecords: 5,
  lowScore: 35,
  mediumScore: 60,
  highScore: 80,
  unavailableSignalPenalty: 10,
} as const;
