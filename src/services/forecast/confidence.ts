// ============================================================
// Product evidence indicator, not statistical confidence.
// It never changes a numerical estimate.
// ============================================================

import type { ForecastConfidence, ForecastSourceType } from '../../types/forecast';

const PERSONAL_RECORD_THRESHOLDS = { medium: 2, high: 5 } as const;

export function calculateConfidence(sourceType: ForecastSourceType, comparableRecords: number, unavailableContextSignals: number): ForecastConfidence {
  if (sourceType === 'insufficient_evidence') {
    return {
      level: 'Low', score: 0, comparable_records: comparableRecords, unavailable_context_signals: unavailableContextSignals,
      detail: 'No compatible empirical quantity basis is available.',
    };
  }
  if (sourceType === 'public_benchmark') {
    return {
      level: 'Low', score: 25, comparable_records: 0, unavailable_context_signals: unavailableContextSignals,
      detail: 'This is a public market benchmark approximation, not observed item-level session sales.',
    };
  }
  const level = comparableRecords >= PERSONAL_RECORD_THRESHOLDS.high ? 'High'
    : comparableRecords >= PERSONAL_RECORD_THRESHOLDS.medium ? 'Medium'
      : 'Low';
  const score = level === 'High' ? 80 : level === 'Medium' ? 60 : 40;
  return {
    level,
    score,
    comparable_records: comparableRecords,
    unavailable_context_signals: unavailableContextSignals,
    detail: `${comparableRecords} private completed comparable session${comparableRecords === 1 ? '' : 's'} inform this empirical estimate.`,
  };
}
