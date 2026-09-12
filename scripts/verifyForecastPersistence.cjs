const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const moduleCache = new Map();
const writes = { recommendations: [], signals: [], evidence: [] };
const supabaseStub = {
  from(table) {
    if (table === 'recommendations') {
      const builder = {
        insert(row) { writes.recommendations.push(row); return builder; },
        select() { return builder; },
        async single() { return { data: { id: `recommendation-${writes.recommendations.length}` }, error: null }; },
        delete() { return builder; },
        eq() { return builder; },
      };
      return builder;
    }
    if (table === 'external_signals') {
      return {
        insert(rows) { writes.signals.push(...rows); return Promise.resolve({ error: null }); },
      };
    }
    if (table === 'forecast_evidence_snapshots') {
      return {
        insert(row) { writes.evidence.push(row); return Promise.resolve({ error: null }); },
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  },
};

function loadTypeScriptModule(filename) {
  const resolved = path.resolve(filename.endsWith('.ts') ? filename : `${filename}.ts`);
  if (moduleCache.has(resolved)) return moduleCache.get(resolved).exports;
  const module = { exports: {} };
  moduleCache.set(resolved, module);
  const source = fs.readFileSync(resolved, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
  }).outputText;
  const scopedRequire = request => {
    if (request === '../../lib/supabase') return { isSupabaseConfigured: true, supabase: supabaseStub };
    if (!request.startsWith('.')) return require(request);
    return loadTypeScriptModule(path.resolve(path.dirname(resolved), request));
  };
  const execute = new Function('require', 'exports', 'module', '__filename', '__dirname', output);
  execute(scopedRequire, module.exports, module, resolved, path.dirname(resolved));
  return module.exports;
}

const { saveForecastResult, FORECAST_SOURCE } = loadTypeScriptModule('src/services/forecast/forecastDataService.ts');

const baseResult = {
  is_estimate_available: true,
  source_type: 'personalized',
  evidence_level: 'personal_observations',
  unit: 'bowls',
  baseline_quantity: 66,
  estimated_min: 65,
  estimated_max: 70,
  recommended_quantity: 68,
  total_adjustment: 0,
  comparable_strategy: 'same food and location',
  comparable_records: 3,
  confidence: { level: 'Medium', score: 60, comparable_records: 3, unavailable_context_signals: 0, detail: 'test' },
  signals: [{ kind: 'personal_history', label: 'Seller history', role: 'personal_calibration', availability: 'available', detail: 'test' }],
  explanation_facts: ['3 comparable completed sessions averaged 66 bowls.'],
  low_data_message: null,
  weather: {
    availability: 'available', condition: 'clear', summary: 'test', source: 'Open-Meteo Forecast API',
    temperature_c: 29, precipitation_probability: 20, precipitation_mm: 0, weather_code: 2,
    period_start: '2026-09-12T17:00', period_end: '2026-09-12T22:00',
  },
  historical_weather: {
    availability: 'available', summary: 'Historical test', source: 'Open-Meteo Historical Weather API', source_url: 'https://open-meteo.com/en/docs/historical-weather-api',
    reference_date: '2025-09-12', temperature_c: 28, precipitation_mm: 0, weather_code: 1,
  },
  calendar_context: {
    availability: 'unavailable', is_public_holiday: null, holiday_name: null, summary: 'Unavailable', source: null, source_url: null,
  },
  transit_context: {
    availability: 'unavailable', summary: 'Unavailable', station_name: null, trips: null, source: null, source_url: null,
  },
  events: [],
  events_availability: 'available',
  price_insight: {
    availability: 'unavailable', summary: 'Price reference unavailable.', source_name: null, reference_url: null,
    item_name: null, unit: null, recent_price: null, price_date: null, sample_size: null,
  },
  public_benchmark: {
    availability: 'available', quantity_basis: 'per_bazaar_period_revenue_equivalent', estimate_quantity: 4200, estimated_min: 3700, estimated_max: 4600,
    sample_size: 16, population_variance: 250000, selected_scope: 'W.P. Kuala Lumpur', sales_value_per_stall: 33600, persons_engaged_per_stall: 2.9,
    serving_price: 8, price_basis: 'seller_declared_menu_price', methodology: 'test', limitation: 'test limitation',
    sources: [{ source_id: 'dosm', name: 'DOSM', publisher: 'DOSM', source_url: 'https://example.test', license: null, coverage_start: null, coverage_end: null, retrieved_at: null, what_it_measures: 'market benchmark', data_role: 'benchmark' }],
  },
  model_name: 'public_benchmark_empirical_estimator',
  model_version: '2.0.0',
  methodology: 'test methodology',
};

(async () => {
  const saved = await saveForecastResult('plan-1', 'food-1', baseResult);
  assert.deepEqual(saved, { data: { recommendationId: 'recommendation-1' }, error: null });
  assert.deepEqual(writes.recommendations[0], {
    selling_plan_id: 'plan-1', food_id: 'food-1', recommended_qty: 68, min_qty: 65, max_qty: 70,
    confidence: 60, reasoning: baseResult.explanation_facts[0], source: FORECAST_SOURCE,
  });
  assert.equal(writes.signals.length, 8, 'Forecast, normalized provider/context, and summary signals should persist');
  assert.equal(writes.signals[1].signal_type, 'weather_observation');
  assert.deepEqual(writes.signals[1].signal_data, {
    availability: 'available', condition: 'clear', temperature_c: 29, precipitation_probability: 20,
    precipitation_mm: 0, weather_code: 2, period_start: '2026-09-12T17:00', period_end: '2026-09-12T22:00', summary: 'test',
  });
  assert.equal(writes.signals[2].signal_type, 'historical_weather_context');
  assert.equal(writes.signals[3].signal_type, 'holiday_context');
  assert.equal(writes.signals[4].signal_type, 'transit_context');
  assert.equal(writes.signals[5].signal_type, 'nearby_event_context');
  assert.deepEqual(writes.signals[5].signal_data, { availability: 'available', events: [] });
  assert.equal(writes.signals[6].signal_type, 'price_reference');
  assert.equal(writes.signals[7].signal_type, 'forecast_summary');
  assert.equal(writes.signals[7].signal_data.baseline_quantity, 66);
  assert.equal(writes.evidence.length, 1, 'A separate evidence snapshot must be retained outside external_signals');
  assert.equal(writes.evidence[0].source_type, 'personalized');

  const noEstimate = { ...baseResult, is_estimate_available: false, source_type: 'insufficient_evidence', evidence_level: 'insufficient_evidence', baseline_quantity: null, estimated_min: null, estimated_max: null, recommended_quantity: null };
  const savedNoEstimate = await saveForecastResult('plan-2', 'food-1', noEstimate);
  assert.deepEqual(savedNoEstimate, { data: { recommendationId: null }, error: null });
  assert.equal(writes.recommendations.length, 1, 'Low-data flow must not write a fake zero-valued recommendation');
  assert.equal(writes.signals.at(-1).signal_data.status, 'insufficient_evidence');

  console.log('Forecast persistence verification passed: recommendations and external signals use the existing schema.');
})();
