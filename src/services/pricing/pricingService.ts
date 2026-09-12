// ============================================================
// Price-reference abstraction. It never presents a grocery/consumer
// reference as a seller's exact menu price.
// ============================================================

import type { PriceInsight } from '../../types/forecast';

export interface PricingRequest {
  food_name: string;
  food_category: string;
  location_name: string | null;
}

export interface PricingService {
  getInsight(request: PricingRequest): Promise<PriceInsight>;
}

const unavailable = (): PriceInsight => ({
  availability: 'unavailable',
  summary: 'Price reference unavailable.',
  source_name: null,
  reference_url: null,
});

export class RealPricingService implements PricingService {
  private readonly endpoint: string;

  constructor(endpoint: string) {
    this.endpoint = endpoint;
  }

  async getInsight(request: PricingRequest): Promise<PriceInsight> {
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      const payload: unknown = await response.json();
      if (!response.ok || !payload || typeof payload !== 'object') return unavailable();
      const data = payload as Record<string, unknown>;
      if (typeof data.summary !== 'string' || typeof data.source_name !== 'string') return unavailable();
      return {
        availability: 'available',
        summary: data.summary,
        source_name: data.source_name,
        reference_url: typeof data.reference_url === 'string' ? data.reference_url : null,
      };
    } catch {
      return unavailable();
    }
  }
}

class UnavailablePricingService implements PricingService {
  async getInsight(): Promise<PriceInsight> {
    return unavailable();
  }
}

export function getPricingService(): PricingService {
  const endpoint = import.meta.env.VITE_PRICE_REFERENCE_ENDPOINT?.trim();
  return endpoint ? new RealPricingService(endpoint) : new UnavailablePricingService();
}
