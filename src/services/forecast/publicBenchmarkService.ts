// ============================================================
// Read-only public benchmark lookup.
//
// The DOSM bazaar release measures market-level sales value, stalls and people
// engaged. It does not contain food-item units sold. This service never calls
// those records a demand label. It can expose a transparent revenue-equivalent
// benchmark only when a real per-serving price denominator is available.
// ============================================================

import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import type { DataSource, PublicBazaarBenchmark, PublicItemPrice } from '../../types/database';
import type { ForecastPlanContext, PublicBenchmarkEvidence, DataSourceProvenance } from '../../types/forecast';

type ServiceResult<T> = { data: T | null; error: string | null };

type BenchmarkRow = PublicBazaarBenchmark & { data_sources?: DataSource | DataSource[] | null };
type PriceRow = PublicItemPrice & { data_sources?: DataSource | DataSource[] | null };

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

function canonicalServingUnit(value: string | null | undefined): string {
  const unit = normaliseForecastText(value);
  if (unit.includes('bowl') || unit.includes('mangkuk')) return 'bowl';
  if (unit.includes('piece') || unit.includes('biji') || unit.includes('sekeping')) return 'piece';
  if (unit.includes('pack') || unit.includes('bungkus')) return 'pack';
  if (unit.includes('set')) return 'set';
  if (unit.includes('kg') || unit.includes('kilogram')) return 'kg';
  if (unit.includes('litre') || unit.includes('liter')) return 'litre';
  if (unit.includes('serving') || unit.includes('hidangan')) return 'serving';
  return unit;
}

function sourceFrom(row: { data_sources?: DataSource | DataSource[] | null }): DataSource | null {
  if (!row.data_sources) return null;
  return Array.isArray(row.data_sources) ? row.data_sources[0] ?? null : row.data_sources;
}

function provenance(source: DataSource | null, role: DataSourceProvenance['data_role']): DataSourceProvenance[] {
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
    data_role: role,
  }];
}

function quantile(values: number[], percentile: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * percentile;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function rounded(value: number | null): number | null {
  return value === null || !Number.isFinite(value) ? null : Math.round(value);
}

function emptyBenchmark(message: string): PublicBenchmarkEvidence {
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
  // DOSM's combined Ramadan/Aidilfitri table is selected intentionally. The
  // date-specific context remains explanatory because this table is not a
  // labelled, per-session food-sales dataset.
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

function chooseOfficialPrice(rows: PriceRow[], context: ForecastPlanContext): PriceRow | null {
  const compatible = rows.filter(row => canonicalServingUnit(row.unit) === canonicalServingUnit(context.food.unit));
  if (compatible.length === 0) return null;
  const stateKey = normalisePlace(context.seller_state);
  return compatible.sort((a, b) => {
    const aState = normalisePlace(a.state);
    const bState = normalisePlace(b.state);
    const aRank = stateKey && aState === stateKey ? 2 : aState === 'malaysia' || !aState ? 1 : 0;
    const bRank = stateKey && bState === stateKey ? 2 : bState === 'malaysia' || !bState ? 1 : 0;
    return bRank - aRank || b.year - a.year;
  })[0] ?? null;
}

function validPrice(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function benchmarkQuantity(row: PublicBazaarBenchmark, servingPrice: number): number | null {
  if (!validPrice(row.sales_value_per_stall) || !validPrice(servingPrice)) return null;
  return row.sales_value_per_stall / servingPrice;
}

function sampleVariance(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((total, value) => total + value, 0) / values.length;
  const squaredDifference = values.reduce((total, value) => total + (value - mean) ** 2, 0);
  return squaredDifference / (values.length - 1);
}

export async function getPublicBenchmarkEvidence(context: ForecastPlanContext): Promise<ServiceResult<PublicBenchmarkEvidence>> {
  if (!isSupabaseConfigured) return { data: emptyBenchmark('Supabase is not configured, so public benchmark data is unavailable.'), error: null };

  const [benchmarkResult, priceResult] = await Promise.all([
    supabase.from('public_bazaar_benchmarks').select('*, data_sources(*)').order('year', { ascending: false }),
    supabase.from('public_item_prices').select('*, data_sources(*)')
      .eq('normalized_food_name', normaliseForecastText(context.food.food_name))
      .order('year', { ascending: false }),
  ]);
  if (benchmarkResult.error) {
    return {
      data: emptyBenchmark(`Validated public benchmark data is unavailable: ${benchmarkResult.error.message}`),
      error: benchmarkResult.error.message,
    };
  }

  const benchmarkRows = (benchmarkResult.data as BenchmarkRow[] | null) ?? [];
  const selected = chooseBenchmark(benchmarkRows, context);
  if (!selected) {
    return {
      data: emptyBenchmark('No validated DOSM bazaar benchmark matches the seller state or national scope.'),
      error: null,
    };
  }

  // A missing price table must not discard seller-owned empirical history or a
  // real seller-entered menu price. It simply removes the official-price path.
  const priceRows = priceResult.error ? [] : (priceResult.data as PriceRow[] | null) ?? [];
  const officialPrice = chooseOfficialPrice(priceRows, context);
  const declaredPrice = validPrice(context.item.unit_price) ? context.item.unit_price
    : validPrice(context.food.avg_price) ? context.food.avg_price
      : null;
  const servingPrice = declaredPrice ?? officialPrice?.average_price ?? null;
  const priceBasis = declaredPrice ? 'seller_declared_menu_price' as const
    : officialPrice ? 'official_bazaar_item_price' as const
      : null;
  if (!servingPrice || !priceBasis) {
    return {
      data: {
        ...emptyBenchmark('A real per-serving menu price is required before market sales value can be expressed as a revenue-equivalent serving benchmark. No quantity was fabricated.'),
        selected_scope: selected.district ?? selected.state ?? 'Malaysia',
        sales_value_per_stall: selected.sales_value_per_stall,
        persons_engaged_per_stall: selected.persons_engaged_per_stall,
        sources: provenance(sourceFrom(selected), 'benchmark'),
      },
      error: priceResult.error?.message ?? null,
    };
  }

  const comparableRevenueValues = benchmarkRows
    .filter(row => row.year === selected.year && row.bazaar_type === selected.bazaar_type)
    .map(row => benchmarkQuantity(row, servingPrice))
    .filter((value): value is number => value !== null);
  const selectedQuantity = benchmarkQuantity(selected, servingPrice);
  if (selectedQuantity === null) return { data: emptyBenchmark('The selected public benchmark has no valid sales-per-stall value.'), error: null };

  const sources = [
    ...provenance(sourceFrom(selected), 'benchmark'),
    ...(officialPrice ? provenance(sourceFrom(officialPrice), 'price_reference') : []),
  ];
  const selectedScope = [selected.district, selected.state].filter(Boolean).join(', ') || 'Malaysia';
  return {
    data: {
      availability: 'available',
      quantity_basis: 'per_bazaar_period_revenue_equivalent',
      estimate_quantity: rounded(selectedQuantity),
      estimated_min: rounded(quantile(comparableRevenueValues, 0.25)),
      estimated_max: rounded(quantile(comparableRevenueValues, 0.75)),
      sample_size: comparableRevenueValues.length,
      population_variance: sampleVariance(comparableRevenueValues),
      selected_scope: selectedScope,
      sales_value_per_stall: selected.sales_value_per_stall,
      persons_engaged_per_stall: selected.persons_engaged_per_stall,
      serving_price: servingPrice,
      price_basis: priceBasis,
      methodology: 'DOSM public sales value per stall ÷ a verified per-serving price. The interval is the interquartile range across the published geographic records for the same year and bazaar table.',
      limitation: 'DOSM publishes bazaar-level sales value, not item-level units sold or per-session sales. This is a revenue-equivalent benchmark for the published bazaar period, not a trained food-demand prediction.',
      sources,
    },
    error: priceResult.error?.message ?? null,
  };
}

export { emptyBenchmark };
