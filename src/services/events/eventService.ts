// ============================================================
// Event abstraction. There is no stable, documented Malaysia-wide events API
// that can safely be called from this browser app. A configured server gateway
// may query an official source such as MyGovEvent or Tourism Malaysia and must
// return only records it actually received. Without that gateway, this service
// deliberately returns no event data rather than inventing an event.
// ============================================================

import type { NearbyEvent } from '../../types/forecast';

export interface EventRequest {
  date: string;
  start_time: string | null;
  end_time: string | null;
  latitude: number | null;
  longitude: number | null;
  location_name: string | null;
}

export interface EventServiceResult {
  events: NearbyEvent[];
  availability: 'available' | 'unavailable';
}

export interface EventService {
  getNearbyEvents(request: EventRequest): Promise<EventServiceResult>;
}

function toEvent(value: unknown): NearbyEvent | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const name = typeof record.name === 'string' ? record.name.trim() : '';
  const source = typeof record.source === 'string' ? record.source.trim() : '';
  if (!name || !source) return null;
  return {
    name,
    distance_km: typeof record.distance_km === 'number' ? record.distance_km : null,
    starts_at: typeof record.starts_at === 'string' ? record.starts_at : null,
    source,
    source_url: typeof record.source_url === 'string' ? record.source_url : null,
  };
}

export class RealEventService implements EventService {
  private readonly endpoint: string;

  constructor(endpoint: string) {
    this.endpoint = endpoint;
  }

  async getNearbyEvents(request: EventRequest): Promise<EventServiceResult> {
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      const payload: unknown = await response.json();
      if (!response.ok || !payload || typeof payload !== 'object') return { events: [], availability: 'unavailable' };
      const rawEvents = (payload as Record<string, unknown>).events;
      if (!Array.isArray(rawEvents)) return { events: [], availability: 'unavailable' };
      return { events: rawEvents.map(toEvent).filter((event): event is NearbyEvent => event !== null), availability: 'available' };
    } catch {
      return { events: [], availability: 'unavailable' };
    }
  }
}

class EmptyEventService implements EventService {
  async getNearbyEvents(): Promise<EventServiceResult> {
    return { events: [], availability: 'unavailable' };
  }
}

export function getEventService(): EventService {
  const endpoint = import.meta.env.VITE_EVENTS_API_ENDPOINT?.trim();
  return endpoint ? new RealEventService(endpoint) : new EmptyEventService();
}
