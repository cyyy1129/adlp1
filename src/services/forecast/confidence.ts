// ============================================================
// Product confidence indicator, not a statistical probability.
// ============================================================

import type { ForecastConfidence } from '../../types/forecast';
import { CONFIDENCE_THRESHOLDS } from './signalWeights';

export function calculateConfidence(comparableRecords: number, unavailableContextSignals: number): ForecastConfidence {
  if (comparableRecords === 0) {
    return {
      level: 'Low',
      score: CONFIDENCE_THRESHOLDS.lowScore,
      comparable_records: 0,
      unavailable_context_signals: unavailableContextSignals,
      detail: 'No completed comparable sessions are available yet.',
    };
  }

  let level: ForecastConfidence['level'] = 'Low';
  let score: number = CONFIDENCE_THRESHOLDS.lowScore;
  if (comparableRecords >= CONFIDENCE_THRESHOLDS.highComparableRecords) {
    level = 'High';
    score = CONFIDENCE_THRESHOLDS.highScore;
  } else if (comparableRecords >= CONFIDENCE_THRESHOLDS.mediumComparableRecords) {
    level = 'Medium';
    score = CONFIDENCE_THRESHOLDS.mediumScore;
  }

  const adjustedScore = Math.max(
    CONFIDENCE_THRESHOLDS.lowScore,
    score - unavailableContextSignals * CONFIDENCE_THRESHOLDS.unavailableSignalPenalty
  );

  if (adjustedScore < CONFIDENCE_THRESHOLDS.mediumScore) level = 'Low';
  else if (adjustedScore < CONFIDENCE_THRESHOLDS.highScore) level = 'Medium';

  return {
    level,
    score: adjustedScore,
    comparable_records: comparableRecords,
    unavailable_context_signals: unavailableContextSignals,
    detail: `${comparableRecords} completed comparable session${comparableRecords === 1 ? '' : 's'} inform this estimate.`,
  };
}
