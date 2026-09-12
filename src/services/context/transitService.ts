// ============================================================
// Optional Rapid Rail contextual signal.
//
// A result exists only after a reviewed, explicit location-to-station mapping
// and an imported official OD observation are both present. Ridership is kept
// as an activity proxy; it is never renamed as bazaar footfall or converted to
// a demand adjustment.
// ============================================================

import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { normaliseForecastText } from '../forecast/publicBenchmarkService';

// Retained as an unused integration boundary for a future, separately
// validated use case. It is intentionally no longer part of Demand Estimate.
interface TransitContext {
  availability: 'available' | 'unavailable';
  summary: string;
  station_name: string | null;
  trips: number | null;
  source: string | null;
  source_url: string | null;
}

function unavailable(summary: string): TransitContext {
  return { availability: 'unavailable', summary, station_name: null, trips: null, source: null, source_url: null };
}

export async function getTransitContext(locationName: string | null, date: string): Promise<TransitContext> {
  if (!isSupabaseConfigured) return unavailable('Transit context is unavailable because Supabase is not configured.');
  const locationKey = normaliseForecastText(locationName);
  if (!locationKey) return unavailable('Transit context is unavailable because the selling location is not named.');

  const { data: linkData, error: linkError } = await supabase
    .from('public_location_station_links')
    .select('station_name')
    .eq('canonical_location_key', locationKey)
    .eq('validation_status', 'validated')
    .maybeSingle();
  if (linkError || !linkData) return unavailable('No reviewed location-to-station mapping is available. Rapid Rail data was not used.');

  const { data, error } = await supabase
    .from('public_context_observations')
    .select('numeric_value, unit, data_sources(name, source_url)')
    .eq('canonical_location_key', locationKey)
    .eq('observation_date', date)
    .eq('signal_type', 'rapid_rail_od_trips')
    .limit(1)
    .maybeSingle();
  if (error || !data || typeof (data as { numeric_value?: unknown }).numeric_value !== 'number') {
    return unavailable(`No verified Rapid Rail activity observation is available for ${date}. It was not used.`);
  }
  const row = data as { numeric_value: number; data_sources?: { name?: string; source_url?: string } | { name?: string; source_url?: string }[] | null };
  const source = Array.isArray(row.data_sources) ? row.data_sources[0] : row.data_sources;
  return {
    availability: 'available',
    summary: `${row.numeric_value.toLocaleString()} recorded Rapid Rail OD trips are linked to the reviewed station mapping. This is a mobility/activity proxy, not bazaar footfall, and does not adjust quantity.`,
    station_name: (linkData as { station_name: string }).station_name,
    trips: row.numeric_value,
    source: source?.name ?? 'data.gov.my Rapid Rail ridership',
    source_url: source?.source_url ?? 'https://data.gov.my/data-catalogue/ridership_od_rapidrail_daily',
  };
}
