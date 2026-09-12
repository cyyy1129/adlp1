// ============================================================
// Open-Meteo integration. It is intentionally direct and keyless: when the
// service cannot return an actual forecast, the caller gets an unavailable
// signal rather than a substitute or development weather value.
// ============================================================

import type { WeatherCondition, WeatherForecast } from '../../types/forecast';

export interface WeatherRequest {
  date: string;
  start_time: string | null;
  end_time: string | null;
  latitude: number | null;
  longitude: number | null;
  location_name: string | null;
}

export interface WeatherService {
  getForecast(request: WeatherRequest): Promise<WeatherForecast>;
}

function unavailableWeather(message: string): WeatherForecast {
  return {
    availability: 'unavailable',
    condition: null,
    summary: message,
    source: null,
    temperature_c: null,
    precipitation_probability: null,
    precipitation_mm: null,
    weather_code: null,
    period_start: null,
    period_end: null,
  };
}

interface OpenMeteoHourly {
  time?: unknown;
  temperature_2m?: unknown;
  precipitation_probability?: unknown;
  precipitation?: unknown;
  weather_code?: unknown;
}

interface OpenMeteoResponse {
  hourly?: OpenMeteoHourly;
}

interface HourlySample {
  time: string;
  temperature_c: number;
  precipitation_probability: number;
  precipitation_mm: number;
  weather_code: number;
}

const RAIN_WEATHER_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);
const CLEAR_WEATHER_CODES = new Set([0, 1, 2]);
const HOT_TEMPERATURE_C = 32;

function toNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function rounded(value: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function sessionBounds(request: WeatherRequest): { start: string; end: string } {
  const start = `${request.date}T${request.start_time ?? '00:00'}`;
  const end = `${request.date}T${request.end_time ?? '23:59'}`;
  return end >= start ? { start, end } : { start, end: `${request.date}T23:59` };
}

function selectSamples(request: WeatherRequest, hourly: OpenMeteoHourly): HourlySample[] {
  if (!Array.isArray(hourly.time) || !Array.isArray(hourly.temperature_2m) || !Array.isArray(hourly.precipitation_probability)
    || !Array.isArray(hourly.precipitation) || !Array.isArray(hourly.weather_code)) return [];

  const bounds = sessionBounds(request);
  const onSellingDate: HourlySample[] = [];
  for (let index = 0; index < hourly.time.length; index += 1) {
    const time = hourly.time[index];
    const temperature_c = toNumber(hourly.temperature_2m[index]);
    const precipitation_probability = toNumber(hourly.precipitation_probability[index]);
    const precipitation_mm = toNumber(hourly.precipitation[index]);
    const weather_code = toNumber(hourly.weather_code[index]);
    if (typeof time !== 'string' || !time.startsWith(request.date) || temperature_c === null
      || precipitation_probability === null || precipitation_mm === null || weather_code === null) continue;
    const sample = { time, temperature_c, precipitation_probability, precipitation_mm, weather_code };
    onSellingDate.push(sample);
  }

  const duringSession = onSellingDate.filter(sample => sample.time >= bounds.start && sample.time <= bounds.end);
  return duringSession.length > 0 ? duringSession : onSellingDate;
}

function determineCondition(samples: HourlySample[], temperature_c: number, precipitation_probability: number, precipitation_mm: number): WeatherCondition {
  const mostSevere = samples.reduce((selected, sample) => {
    const selectedScore = selected.precipitation_probability * 10 + selected.precipitation_mm;
    const sampleScore = sample.precipitation_probability * 10 + sample.precipitation_mm;
    return sampleScore > selectedScore ? sample : selected;
  });
  if (RAIN_WEATHER_CODES.has(mostSevere.weather_code) || precipitation_mm > 0 || precipitation_probability >= 60) return 'rain';
  if (temperature_c >= HOT_TEMPERATURE_C) return 'hot';
  return CLEAR_WEATHER_CODES.has(mostSevere.weather_code) ? 'clear' : 'other';
}

export class OpenMeteoWeatherService implements WeatherService {
  async getForecast(request: WeatherRequest): Promise<WeatherForecast> {
    if (request.latitude === null || request.longitude === null) {
      return unavailableWeather('Weather is unavailable until this selling location has map coordinates. No weather adjustment was applied.');
    }

    try {
      const url = new URL('https://api.open-meteo.com/v1/forecast');
      url.search = new URLSearchParams({
        latitude: String(request.latitude),
        longitude: String(request.longitude),
        hourly: 'temperature_2m,precipitation_probability,precipitation,weather_code',
        timezone: 'auto',
        start_date: request.date,
        end_date: request.date,
      }).toString();
      const response = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
      const payload = await response.json() as OpenMeteoResponse;
      if (!response.ok || !payload || typeof payload !== 'object' || !payload.hourly) {
        return unavailableWeather('Weather data is currently unavailable. No weather adjustment was applied.');
      }
      const samples = selectSamples(request, payload.hourly);
      if (samples.length === 0) return unavailableWeather('Weather data is unavailable for this selling date and time. No weather adjustment was applied.');

      const temperature_c = rounded(average(samples.map(sample => sample.temperature_c)));
      const precipitation_probability = Math.round(Math.max(...samples.map(sample => sample.precipitation_probability)));
      const precipitation_mm = rounded(samples.reduce((sum, sample) => sum + sample.precipitation_mm, 0));
      const representative = samples.reduce((selected, sample) => {
        const selectedScore = selected.precipitation_probability * 10 + selected.precipitation_mm;
        const sampleScore = sample.precipitation_probability * 10 + sample.precipitation_mm;
        return sampleScore > selectedScore ? sample : selected;
      });
      const condition = determineCondition(samples, temperature_c, precipitation_probability, precipitation_mm);
      return {
        availability: 'available',
        condition,
        summary: `During this selling session: about ${temperature_c}°C, up to ${precipitation_probability}% precipitation probability, and ${precipitation_mm} mm precipitation forecast.`,
        source: 'Open-Meteo Forecast API',
        temperature_c,
        precipitation_probability,
        precipitation_mm,
        weather_code: representative.weather_code,
        period_start: samples[0].time,
        period_end: samples.at(-1)?.time ?? samples[0].time,
      };
    } catch {
      return unavailableWeather('Weather data is currently unavailable. No weather adjustment was applied.');
    }
  }
}

export function getWeatherService(): WeatherService {
  return new OpenMeteoWeatherService();
}
