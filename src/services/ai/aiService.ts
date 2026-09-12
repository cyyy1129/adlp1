// ============================================================
// Replaceable AI extraction gateway.
// A configured endpoint should be a server-side gateway so provider
// credentials are never embedded in the browser bundle.
// ============================================================

import type { ExtractionRequest, ExtractionResult, FoodSelection, SellingLocation, SellingSchedule } from '../../types/planning';
import { extractFood, extractLocation, extractSchedule } from './extraction';

const endpoint = import.meta.env.VITE_AI_EXTRACTION_ENDPOINT?.trim();

type ExtractedValue = SellingSchedule | SellingLocation | FoodSelection;

function localResult(request: ExtractionRequest, fallbackNotice: string | null): ExtractionResult<ExtractedValue> {
  const referenceDate = request.referenceDate ? new Date(`${request.referenceDate}T12:00:00`) : new Date();
  const extracted = request.field === 'schedule'
    ? extractSchedule(request.input, referenceDate)
    : request.field === 'location'
      ? extractLocation(request.input)
      : extractFood(request.input);

  return { ...extracted, source: 'mock', fallbackNotice };
}

function isRemoteResult(value: unknown): value is Omit<ExtractionResult<ExtractedValue>, 'source' | 'fallbackNotice'> {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return Array.isArray(candidate.missing)
    && candidate.missing.every(item => typeof item === 'string')
    && (candidate.data === null || typeof candidate.data === 'object')
    && (typeof candidate.error === 'string' || candidate.error === null);
}

function hasExpectedFields(field: ExtractionRequest['field'], data: ExtractedValue | null): boolean {
  if (!data) return true;
  if (field === 'schedule') {
    const schedule = data as SellingSchedule;
    return typeof schedule.date === 'string' && typeof schedule.start_time === 'string' && typeof schedule.end_time === 'string';
  }
  if (field === 'location') {
    const location = data as SellingLocation;
    return typeof location.location_name === 'string';
  }
  const food = data as FoodSelection;
  return typeof food.food_name === 'string' && typeof food.food_category === 'string';
}

export async function extractPlanningInput(request: ExtractionRequest): Promise<ExtractionResult<ExtractedValue>> {
  if (!endpoint) {
    return localResult(request, null);
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...request, task: 'planning_extraction' }),
      signal: controller.signal,
    });
    const body: unknown = await response.json();

    if (!response.ok || !isRemoteResult(body) || !hasExpectedFields(request.field, body.data as ExtractedValue | null)) {
      throw new Error('The AI response was unavailable or invalid.');
    }

    return {
      ...body,
      source: 'remote',
      fallbackNotice: null,
    };
  } catch {
    return localResult(
      request,
      'AI extraction is unavailable right now, so we used the on-device fallback. Please review the confirmation carefully.'
    );
  } finally {
    window.clearTimeout(timeout);
  }
}
