// ============================================================
// Official-holiday context abstraction.
//
// Malaysia does not expose a stable, public browser API that this app can
// verify directly. A deployment may configure a server-side gateway backed by
// an official machine-readable source. Without it, the application reports the
// context as unavailable and never assumes a holiday or a demand multiplier.
// ============================================================

import type { CalendarContext } from '../../types/forecast';

export interface HolidayService {
  getContext(date: string, state: string | null): Promise<CalendarContext>;
}

function unavailable(): CalendarContext {
  return {
    availability: 'unavailable',
    is_public_holiday: null,
    holiday_name: null,
    summary: 'Official public-holiday data is unavailable. It does not affect the estimate.',
    source: null,
    source_url: null,
  };
}

export class OfficialHolidayGatewayService implements HolidayService {
  private readonly endpoint: string;

  constructor(endpoint: string) {
    this.endpoint = endpoint;
  }

  async getContext(date: string, state: string | null): Promise<CalendarContext> {
    try {
      const url = new URL(this.endpoint);
      url.search = new URLSearchParams({ date, ...(state ? { state } : {}) }).toString();
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      const payload: unknown = await response.json();
      if (!response.ok || !payload || typeof payload !== 'object') return unavailable();
      const record = payload as Record<string, unknown>;
      if (typeof record.is_public_holiday !== 'boolean' || typeof record.source !== 'string' || typeof record.source_url !== 'string') return unavailable();
      const holidayName = typeof record.holiday_name === 'string' ? record.holiday_name : null;
      return {
        availability: 'available',
        is_public_holiday: record.is_public_holiday,
        holiday_name: holidayName,
        summary: record.is_public_holiday
          ? `${holidayName ?? 'Public holiday'} is listed by the configured official source. Context only; no quantity adjustment is applied.`
          : 'No public holiday is listed by the configured official source. Context only; no quantity adjustment is applied.',
        source: record.source,
        source_url: record.source_url,
      };
    } catch {
      return unavailable();
    }
  }
}

class UnavailableHolidayService implements HolidayService {
  async getContext(): Promise<CalendarContext> {
    return unavailable();
  }
}

export function getHolidayService(): HolidayService {
  const endpoint = import.meta.env.VITE_OFFICIAL_HOLIDAYS_API_ENDPOINT?.trim();
  return endpoint ? new OfficialHolidayGatewayService(endpoint) : new UnavailableHolidayService();
}
