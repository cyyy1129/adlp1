// ============================================================
// Open-Meteo historical weather context.
//
// This is intentionally separate from the future-weather service. Historical
// weather is displayed as an observed contextual record only; it never changes
// a quantity unless a future labelled-demand model validates that relationship.
// ============================================================

import type { HistoricalWeatherContext } from '../../types/forecast';
import type { WeatherRequest } from './weatherService';

interface ArchiveHourly {
  time?: unknown;
  temperature_2m?: unknown;
  precipitation?: unknown;
  weather_code?: unknown;
}

interface ArchiveResponse {
  hourly?: ArchiveHourly;
}

function unavailable(summary: string): HistoricalWeatherContext {
  return {
    availability: 'unavailable',
    summary,
    source: null,
    source_url: null,
    reference_date: null,
    temperature_c: null,
    precipitation_mm: null,
    weather_code: null,
  };
}

function average(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function rounded(value: number): number {
  return Math.round(value * 10) / 10;
}

function priorCalendarDate(date: string): string | null {
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return null;
  const previous = new Date(Date.UTC(year - 1, month - 1, day));
  if (previous.getUTCMonth() !== month - 1) return null; // Feb 29 has no prior-year counterpart.
  return previous.toISOString().slice(0, 10);
}

function selectSessionSamples(request: WeatherRequest, hourly: ArchiveHourly): { temperatures: number[]; precipitation: number[]; codes: number[] } | null {
  if (!Array.isArray(hourly.time) || !Array.isArray(hourly.temperature_2m) || !Array.isArray(hourly.precipitation) || !Array.isArray(hourly.weather_code)) return null;
  const referenceDate = priorCalendarDate(request.date);
  if (!referenceDate) return null;
  const start = `${referenceDate}T${request.start_time ?? '00:00'}`;
  const end = `${referenceDate}T${request.end_time ?? '23:59'}`;
  const temperatures: number[] = [];
  const precipitation: number[] = [];
  const codes: number[] = [];
  for (let index = 0; index < hourly.time.length; index += 1) {
    const time = hourly.time[index];
    const temp = hourly.temperature_2m[index];
    const rain = hourly.precipitation[index];
    const code = hourly.weather_code[index];
    if (typeof time !== 'string' || time < start || time > end || typeof temp !== 'number' || typeof rain !== 'number' || typeof code !== 'number') continue;
    temperatures.push(temp);
    precipitation.push(rain);
    codes.push(code);
  }
  return temperatures.length > 0 ? { temperatures, precipitation, codes } : null;
}

export interface HistoricalWeatherService {
  getHistoricalContext(request: WeatherRequest): Promise<HistoricalWeatherContext>;
}

export class OpenMeteoHistoricalWeatherService implements HistoricalWeatherService {
  async getHistoricalContext(request: WeatherRequest): Promise<HistoricalWeatherContext> {
    if (request.latitude === null || request.longitude === null) {
      return unavailable('Historical weather is unavailable until the selling location has coordinates. It does not affect the estimate.');
    }
    const referenceDate = priorCalendarDate(request.date);
    if (!referenceDate) return unavailable('No same-calendar-date historical weather reference is available for this date.');

    try {
      const url = new URL('https://archive-api.open-meteo.com/v1/archive');
      url.search = new URLSearchParams({
        latitude: String(request.latitude),
        longitude: String(request.longitude),
        start_date: referenceDate,
        end_date: referenceDate,
        hourly: 'temperature_2m,precipitation,weather_code',
        timezone: 'auto',
      }).toString();
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      const payload = await response.json() as ArchiveResponse;
      const samples = response.ok && payload.hourly ? selectSessionSamples(request, payload.hourly) : null;
      if (!samples) return unavailable('Open-Meteo historical weather did not return a comparable observed period. It does not affect the estimate.');
      const maxPrecipitation = samples.precipitation.reduce((sum, value) => sum + value, 0);
      return {
        availability: 'available',
        summary: `Observed on ${referenceDate} during the same clock hours: about ${rounded(average(samples.temperatures))}°C and ${rounded(maxPrecipitation)} mm precipitation. Context only; no quantity adjustment is applied.`,
        source: 'Open-Meteo Historical Weather API',
        source_url: 'https://open-meteo.com/en/docs/historical-weather-api',
        reference_date: referenceDate,
        temperature_c: rounded(average(samples.temperatures)),
        precipitation_mm: rounded(maxPrecipitation),
        weather_code: samples.codes[0] ?? null,
      };
    } catch {
      return unavailable('Historical weather is currently unavailable. It does not affect the estimate.');
    }
  }
}

export function getHistoricalWeatherService(): HistoricalWeatherService {
  return new OpenMeteoHistoricalWeatherService();
}
