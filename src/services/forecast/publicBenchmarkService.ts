// ============================================================
// Read-only public bazaar context lookup.
//
// The imported DOSM release measures bazaar-level sales value, stalls, and
// people engaged. It has no item-level, per-session units-sold label. This
// service preserves that provenance and deliberately does not divide market
// revenue by a price to manufacture a food-demand quantity.
// ============================================================

import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import type { DataSource, PublicBazaarBenchmark } from '../../types/database';
import type { DataSourceProvenance, ForecastPlanContext, PublicBenchmarkEvidence } from '../../types/forecast';

type ServiceResult<T> = { data: T | null; error: string | null };
type BenchmarkRow = PublicBazaarBenchmark & { data_sources?: DataSource | DataSource[] | null };

export function normaliseForecastText(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

function normalisePlace(value: string | null | undefined): string {
  const normalised = normaliseForecastText(value);
  if (normalised === 'wpkualalumpur' || normalised === 'wilayahpersekutuankualalumpur') return 'kualalumpur';
  if (normalised === 'wpputrajaya' || normalised === 'wilayahpersekutuanputrajaya') return 'putrajaya';
  if (normalised === 'wplabuan' || normalised === 'wilayahpersekutuanlabuan') return 'labuan';
  return normalised;
}

function sourceFrom(row: { data_sources?: DataSource | DataSource[] | null }): DataSource | null {
  if (!row.data_sources) return null;
  return Array.isArray(row.data_sources) ? row.data_sources[0] ?? null : row.data_sources;
}

function provenance(source: DataSource | null): DataSourceProvenance[] {
  if (!source) return [];
  return [{
    source_id: source.id,
    name: source.name,
    publisher: source.publisher,
    source_url: source.source_url,
    license: source.license,
    coverage_start: source.coverage_start,
    coverage_end: source.coverage_end,
    retrieved_at: source.retrieved_at,
    what_it_measures: typeof source.notes?.what_it_measures === 'string'
      ? source.notes.what_it_measures
      : 'Public source metadata is available in the data source record.',
    data_role: 'benchmark',
  }];
}

export function emptyBenchmark(message: string): PublicBenchmarkEvidence {
  return {
    availability: 'unavailable',
    quantity_basis: 'not_convertible',
    estimate_quantity: null,
    estimated_min: null,
    estimated_max: null,
    sample_size: 0,
    population_variance: null,
    selected_scope: null,
    sales_value_per_stall: null,
    persons_engaged_per_stall: null,
    serving_price: null,
    price_basis: null,
    methodology: 'No public quantity conversion was performed.',
    limitation: message,
    sources: [],
  };
}

function chooseBenchmark(rows: BenchmarkRow[], context: ForecastPlanContext): BenchmarkRow | null {
  const combined = rows.filter(row => row.bazaar_type === 'ramadan_and_aidilfitri');
  const candidates = combined.length > 0 ? combined : rows;
  const stateKey = normalisePlace(context.seller_state);
  const cityKey = normalisePlace(context.seller_city);
  const ranked = candidates.map(row => {
    const rowState = normalisePlace(row.state);
    const rowDistrict = normalisePlace(row.district);
    const rowLocation = normalisePlace(row.location_name);
    let score = 0;
    if (cityKey && (rowDistrict === cityKey || rowLocation === cityKey)) score = 3;
    else if (stateKey && rowState === stateKey) score = 2;
    else if (normalisePlace(row.state) === 'malaysia') score = 1;
    return { row, score };
  }).filter(candidate => candidate.score > 0);
  return ranked.sort((a, b) => b.score - a.score || b.row.year - a.row.year)[0]?.row ?? null;
}

export async function getPublicBenchmarkEvidence(context: ForecastPlanContext): Promise<ServiceResult<PublicBenchmarkEvidence>> {
  if (!isSupabaseConfigured) return { data: emptyBenchmark('Public bazaar context is unavailable because Supabase is not configured.'), error: null };

  const benchmarkResult = await supabase
    .from('public_bazaar_benchmarks')
    .select('*, data_sources(*)')
    .order('year', { ascending: false });

  if (benchmarkResult.error) {
    // Detailed database errors belong in developer diagnostics, not the seller
    // interface. The forecast engine can continue with seller-owned evidence.
    console.error('[DemandLens forecast] Public bazaar context lookup failed.', benchmarkResult.error);
    return { data: emptyBenchmark('Public bazaar market context is currently unavailable.'), error: null };
  }

  const benchmarkRows = (benchmarkResult.data as BenchmarkRow[] | null) ?? [];
  const selected = chooseBenchmark(benchmarkRows, context);
  if (!selected) {
    return {
      data: emptyBenchmark('No published public bazaar market context matches this seller area.'),
      error: null,
    };
  }

  const selectedScope = [selected.district, selected.state].filter(Boolean).join(', ') || 'Malaysia';
  return {
    data: {
      availability: 'available',
      quantity_basis: 'not_convertible',
      estimate_quantity: null,
      estimated_min: null,
      estimated_max: null,
      sample_size: 0,
      population_variance: null,
      selected_scope: selectedScope,
      sales_value_per_stall: selected.sales_value_per_stall,
      persons_engaged_per_stall: selected.persons_engaged_per_stall,
      serving_price: null,
      price_basis: null,
      methodology: 'Matched official DOSM bazaar market statistics by published geographic scope. The release measures stalls, persons engaged, and market sales value.',
      limitation: 'This public source does not contain food-item, per-session units sold, so it is shown as market context only and does not produce a preparation quantity.',
      sources: provenance(sourceFrom(selected)),
    },
    error: null,
  };
}
