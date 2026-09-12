// ============================================================
// Local, deterministic extraction used for development and fallback.
// It never supplies information that was not present in the response.
// ============================================================

import type { FoodSelection, SellingLocation, SellingSchedule } from '../../types/planning';

export interface LocalExtraction<T> {
  data: T | null;
  missing: string[];
  error: string | null;
}

const DAY_NAMES: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  ahad: 0,
  isnin: 1,
  selasa: 2,
  rabu: 3,
  khamis: 4,
  jumaat: 5,
  'jumat': 5,
  sabtu: 6,
};

const MONTH_NAMES: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

function atStartOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isRealDate(year: number, monthIndex: number, day: number): boolean {
  const date = new Date(year, monthIndex, day);
  return date.getFullYear() === year && date.getMonth() === monthIndex && date.getDate() === day;
}

function parseDate(input: string, referenceDate: Date): string | null {
  const normalized = input.toLowerCase().replace(/\s+/g, ' ').trim();
  const today = atStartOfDay(referenceDate);

  if (/\btoday\b|\bhari ini\b/.test(normalized)) return toIsoDate(today);
  if (/\btomorrow\b|\besok\b/.test(normalized)) {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return toIsoDate(tomorrow);
  }

  const isoMatch = normalized.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const monthIndex = Number(isoMatch[2]) - 1;
    const day = Number(isoMatch[3]);
    if (isRealDate(year, monthIndex, day)) return toIsoDate(new Date(year, monthIndex, day));
  }

  // Malaysian numeric date order: DD/MM/YYYY (or DD-MM-YYYY).
  const numericMatch = normalized.match(/\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\b/);
  if (numericMatch) {
    const day = Number(numericMatch[1]);
    const monthIndex = Number(numericMatch[2]) - 1;
    const year = Number(numericMatch[3]);
    if (isRealDate(year, monthIndex, day)) return toIsoDate(new Date(year, monthIndex, day));
  }

  const monthPattern = Object.keys(MONTH_NAMES).join('|');
  const longDate = normalized.match(new RegExp(`\\b(\\d{1,2})\\s+(${monthPattern})(?:\\s+(20\\d{2}))?\\b`, 'i'));
  if (longDate) {
    const day = Number(longDate[1]);
    const monthIndex = MONTH_NAMES[longDate[2].toLowerCase()];
    const year = longDate[3] ? Number(longDate[3]) : today.getFullYear();
    if (isRealDate(year, monthIndex, day)) {
      const candidate = new Date(year, monthIndex, day);
      if (!longDate[3] && candidate < today) candidate.setFullYear(candidate.getFullYear() + 1);
      return toIsoDate(candidate);
    }
  }

  const dayPattern = Object.keys(DAY_NAMES).join('|');
  const weekdayMatch = normalized.match(new RegExp(`\\b(?:(this|next|minggu ini|minggu depan)\\s+)?(${dayPattern})\\b`, 'i'));
  if (weekdayMatch) {
    const modifier = weekdayMatch[1]?.toLowerCase();
    const targetDay = DAY_NAMES[weekdayMatch[2].toLowerCase()];
    let daysAhead = (targetDay - today.getDay() + 7) % 7;
    if (modifier === 'next' || modifier === 'minggu depan') {
      daysAhead += 7;
    }
    const candidate = new Date(today);
    candidate.setDate(candidate.getDate() + daysAhead);
    return toIsoDate(candidate);
  }

  return null;
}

interface ParsedTime {
  value: string;
  meridiem: 'am' | 'pm' | null;
}

function parseTime(value: string, inheritedMeridiem: 'am' | 'pm' | null = null): ParsedTime | null {
  const match = value.trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?$/);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2] ?? '0');
  const explicitMeridiem = match[3]?.replace(/\./g, '') as 'am' | 'pm' | undefined;
  const meridiem = explicitMeridiem ?? inheritedMeridiem;

  if (minutes > 59 || hours > 23 || hours < 0) return null;
  if (meridiem) {
    if (hours < 1 || hours > 12) return null;
    if (meridiem === 'pm' && hours !== 12) hours += 12;
    if (meridiem === 'am' && hours === 12) hours = 0;
  }

  return { value: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`, meridiem };
}

function parseTimeRange(input: string): { start: string; end: string } | null {
  const range = input.match(/(?:\bfrom\s+|\bdari\s+)?(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?)\s*(?:-|–|—|\bto\b|\buntil\b|\bhingga\b|\bsampai\b)\s*(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?)/i);
  if (!range) return null;

  const end = parseTime(range[2]);
  const start = parseTime(range[1], end?.meridiem ?? null);
  if (!start || !end) return null;
  if (start.value >= end.value) return null;

  return { start: start.value, end: end.value };
}

export function extractSchedule(input: string, referenceDate = new Date()): LocalExtraction<SellingSchedule> {
  const date = parseDate(input, referenceDate);
  const timeRange = parseTimeRange(input);
  const missing: string[] = [];

  if (!date) missing.push('the selling date');
  if (!timeRange) {
    missing.push('the start and end time');
  }

  if (missing.length > 0) {
    const invalidRange = /(?:-|–|—|\bto\b|\buntil\b|\bhingga\b|\bsampai\b)/i.test(input) && !timeRange;
    return {
      data: null,
      missing,
      error: invalidRange ? 'Please make sure the end time is later than the start time.' : null,
    };
  }

  return {
    data: { date: date as string, start_time: timeRange!.start, end_time: timeRange!.end },
    missing: [],
    error: null,
  };
}

export function extractLocation(input: string): LocalExtraction<SellingLocation> {
  const locationName = input
    .replace(/^\s*(?:at|in|near|di)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!locationName) {
    return { data: null, missing: ['the selling location'], error: null };
  }

  return {
    data: { location_name: locationName, latitude: null, longitude: null },
    missing: [],
    error: null,
  };
}

export function extractFood(input: string): LocalExtraction<FoodSelection> {
  const foodName = input.replace(/\s+/g, ' ').trim();
  if (!foodName) return { data: null, missing: ['the food you will sell'], error: null };

  return {
    data: { food_name: foodName, food_category: 'Others', seller_food_id: null },
    missing: [],
    error: null,
  };
}
