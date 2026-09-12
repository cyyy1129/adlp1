// ============================================================
// Product evidence indicator, not statistical confidence.
// It never changes a numerical estimate.
// ============================================================

import type { ForecastConfidence, ForecastSourceType } from '../../types/forecast';

const PERSONAL_RECORD_THRESHOLDS = { medium: 2, high: 5 } as const;
const PUBLIC_RECORD_THRESHOLDS = { medium: 5, high: 20 } as const;

export function calculateConfidence(sourceType: ForecastSourceType, comparableRecords: number, unavailableContextSignals: number): ForecastConfidence {
  if (sourceType === 'insufficient_evidence') {
    return {
      level: 'Low', score: 0, comparable_records: comparableRecords, unavailable_context_signals: unavailableContextSignals,
      detail: 'No compatible empirical quantity basis is available.',
    };
  }
  if (sourceType === 'public_benchmark') {
    const level = comparableRecords >= PUBLIC_RECORD_THRESHOLDS.high ? 'High'
      : comparableRecords >= PUBLIC_RECORD_THRESHOLDS.medium ? 'Medium'
        : 'Low';
    const score = level === 'High' ? 70 : level === 'Medium' ? 50 : 25;
    return {
      level, score, comparable_records: comparableRecords, unavailable_context_signals: unavailableContextSignals,
      detail: `${comparableRecords} validated public per-session observation${comparableRecords === 1 ? '' : 's'} inform this product evidence indicator.`,
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
