// ============================================================
// Weather abstraction. A live response is used only when a configured
// gateway returns a recognised condition; mock weather is opt-in only.
// ============================================================

import type { WeatherCondition, WeatherForecast } from '../../types/forecast';

export interface WeatherRequest {
  date: string;
  latitude: number | null;
  longitude: number | null;
  location_name: string | null;
}

export interface WeatherService {
  getForecast(request: WeatherRequest): Promise<WeatherForecast>;
}

function unavailableWeather(message: string): WeatherForecast {
  return { availability: 'unavailable', condition: null, summary: message, source: null };
}

function toCondition(value: unknown): WeatherCondition | null {
  if (value === 'rain' || value === 'clear' || value === 'hot' || value === 'other') return value;
  return null;
}

export class RealWeatherService implements WeatherService {
  private readonly endpoint: string;

  constructor(endpoint: string) {
    this.endpoint = endpoint;
  }

  async getForecast(request: WeatherRequest): Promise<WeatherForecast> {
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      const payload: unknown = await response.json();
      if (!response.ok || !payload || typeof payload !== 'object') return unavailableWeather('Weather data is currently unavailable.');
      const data = payload as Record<string, unknown>;
      const condition = toCondition(data.condition);
      if (!condition || typeof data.summary !== 'string') return unavailableWeather('Weather data could not be verified.');
      return {
        availability: 'available',
        condition,
        summary: data.summary,
        source: typeof data.source === 'string' ? data.source : 'Configured weather service',
      };
    } catch {
      return unavailableWeather('Weather data is currently unavailable.');
    }
  }
}

export class MockWeatherService implements WeatherService {
  private readonly condition: WeatherCondition;

  constructor(condition: WeatherCondition) {
    this.condition = condition;
  }

  async getForecast(): Promise<WeatherForecast> {
    return {
      availability: 'demo',
      condition: this.condition,
      summary: `Development/demo weather: ${this.condition}. It is not live weather data.`,
      source: 'MockWeatherService',
    };
  }
}

class UnavailableWeatherService implements WeatherService {
  async getForecast(): Promise<WeatherForecast> {
    return unavailableWeather('Weather API is not configured.');
  }
}

export function getWeatherService(): WeatherService {
  if (import.meta.env.VITE_USE_MOCK_WEATHER === 'true') {
    const condition = toCondition(import.meta.env.VITE_MOCK_WEATHER_CONDITION) ?? 'clear';
    return new MockWeatherService(condition);
  }

  const endpoint = import.meta.env.VITE_WEATHER_API_ENDPOINT?.trim();
  if (endpoint) return new RealWeatherService(endpoint);
  return new UnavailableWeatherService();
}
