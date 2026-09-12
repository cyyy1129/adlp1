const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const moduleCache = new Map();

function loadTypeScriptModule(filename) {
  const resolved = path.resolve(filename.endsWith('.ts') ? filename : `${filename}.ts`);
  if (moduleCache.has(resolved)) return moduleCache.get(resolved).exports;
  const module = { exports: {} };
  moduleCache.set(resolved, module);
  const output = ts.transpileModule(fs.readFileSync(resolved, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
  }).outputText;
  const scopedRequire = request => request.startsWith('.')
    ? loadTypeScriptModule(path.resolve(path.dirname(resolved), request))
    : require(request);
  new Function('require', 'exports', 'module', '__filename', '__dirname', output)(scopedRequire, module.exports, module, resolved, path.dirname(resolved));
  return module.exports;
}

const { calculateForecast } = loadTypeScriptModule('src/services/forecast/forecastEngine.ts');

const unavailablePrice = {
  availability: 'unavailable', summary: 'Price reference unavailable.', source_name: null, reference_url: null,
  item_name: null, unit: null, recent_price: null, price_date: null, sample_size: null,
};
const weather = {
  availability: 'available', condition: 'clear', summary: 'Verified weather.', source: 'test',
  temperature_c: 28, precipitation_probability: 0, precipitation_mm: 0, weather_code: 1,
  period_start: '2026-09-12T17:00', period_end: '2026-09-12T22:00',
};
const historicalWeather = {
  availability: 'available', summary: 'Verified historical context.', source: 'test', source_url: 'https://example.test/weather',
  reference_date: '2025-09-12', temperature_c: 27, precipitation_mm: 0, weather_code: 1,
};
const calendarContext = {
  availability: 'available', is_public_holiday: false, holiday_name: null, summary: 'Not a holiday.', source: 'test', source_url: 'https://example.test/holiday',
};
const transitContext = {
  availability: 'unavailable', summary: 'No reviewed station mapping.', station_name: null, trips: null, source: null, source_url: null,
};
const publicBenchmark = {
  availability: 'available', quantity_basis: 'per_bazaar_period_revenue_equivalent', estimate_quantity: 4200,
  estimated_min: 3700, estimated_max: 4600, sample_size: 16, population_variance: 250000,
  selected_scope: 'W.P. Kuala Lumpur', sales_value_per_stall: 33600, persons_engaged_per_stall: 2.9,
  serving_price: 8, price_basis: 'seller_declared_menu_price',
  methodology: 'Published sales per stall divided by a verified serving price.',
  limitation: 'Period-level revenue-equivalent benchmark; not item-level session demand.',
  sources: [{ source_id: 'dosm', name: 'DOSM test source', publisher: 'DOSM', source_url: 'https://example.test/dosm', license: null, coverage_start: null, coverage_end: null, retrieved_at: null, what_it_measures: 'market sales per stall', data_role: 'benchmark' }],
};

function session({ sold, date = '2026-09-05', foodId = 'food-a', location = 'Kampar Night Market', crowd = 'Normal', unit = 'bowls' }) {
  return {
    selling_plan_id: `plan-${date}-${sold}-${foodId}`,
    food_id: foodId,
    selling_date: date,
    location_name: location,
    prepared_quantity: sold + 10,
    leftover_quantity: 10,
    estimated_sold_quantity: sold,
    unit,
    crowd_level: crowd,
  };
}

function context(history, date = '2026-09-12') {
  return {
    plan: { id: 'new-plan', user_id: 'user-1', plan_date: date, start_time: '17:00', end_time: '22:00', location_name: 'Kampar Night Market', latitude: null, longitude: null, status: 'confirmed', notes: null, created_at: '', updated_at: '' },
    item: { id: 'item-1', plan_id: 'new-plan', food_id: 'food-a', planned_qty: 0, unit_price: 8, created_at: '', updated_at: '' },
    food: { id: 'food-a', user_id: 'user-1', food_category: 'Noodles', food_name: 'Laksa', unit: 'bowls', avg_price: 8, created_at: '', updated_at: '' },
    seller_state: 'W.P. Kuala Lumpur', seller_city: null,
    historical_sessions: history,
  };
}

function calculate(history, overrides = {}) {
  return calculateForecast({
    context: context(history, overrides.date),
    publicBenchmark: overrides.publicBenchmark ?? publicBenchmark,
    weather: overrides.weather ?? weather,
    historicalWeather: overrides.historicalWeather ?? historicalWeather,
    calendarContext: overrides.calendarContext ?? calendarContext,
    transitContext: overrides.transitContext ?? transitContext,
    events: overrides.events ?? [],
    eventsAvailability: overrides.eventsAvailability ?? 'available',
    priceInsight: overrides.priceInsight ?? unavailablePrice,
  });
}

const manyHistory = [60, 62, 64, 66, 68, 70].map(sold => session({ sold }));
const caseA = calculate(manyHistory);
assert.equal(caseA.source_type, 'personalized', 'Case A: private history should take precedence when it is comparable');
assert.equal(caseA.recommended_quantity, 65, 'Case A: empirical mean must be deterministic');
assert.equal(caseA.confidence.level, 'High', 'Case A: six comparable records should be high product evidence');
assert.deepEqual(caseA, calculate(manyHistory), 'Case A: same inputs must be deterministic');

const caseB = calculate([]);
assert.equal(caseB.source_type, 'public_benchmark', 'Case B: zero seller history should use the validated public benchmark');
assert.equal(caseB.recommended_quantity, 4200, 'Case B: public benchmark is deterministic');
assert.equal(caseB.evidence_level, 'benchmark_approximation');

const caseC = calculate([], { weather: { ...weather, availability: 'unavailable', condition: null, summary: 'Unavailable', source: null, temperature_c: null, precipitation_probability: null, precipitation_mm: null, weather_code: null, period_start: null, period_end: null } });
assert.equal(caseC.recommended_quantity, caseB.recommended_quantity, 'Case C: weather failure cannot alter the numerical benchmark');

const caseD = calculate([], { eventsAvailability: 'unavailable' });
assert.equal(caseD.recommended_quantity, caseB.recommended_quantity, 'Case D: event failure cannot alter the numerical benchmark');

const caseE = calculate([], { priceInsight: unavailablePrice });
assert.equal(caseE.recommended_quantity, caseB.recommended_quantity, 'Case E: secondary PriceCatcher insight cannot alter the benchmark');

const caseF = calculate([session({ sold: 50 }), session({ sold: 70 }), session({ sold: 80 })]);
assert.equal(caseF.baseline_quantity, 67, 'Case F: multiple check-ins should use their empirical mean');

const unavailableBenchmark = { ...publicBenchmark, availability: 'unavailable', quantity_basis: 'not_convertible', estimate_quantity: null, estimated_min: null, estimated_max: null, limitation: 'No convertible public data.', sources: [] };
const caseG = calculate([session({ sold: 90, foodId: 'food-b' })], { publicBenchmark: unavailableBenchmark });
assert.equal(caseG.is_estimate_available, false, 'Case G: another food cannot become this food’s personal basis');

const friday = calculate([session({ sold: 60, date: '2026-09-11' })], { date: '2026-09-11' });
const saturday = calculate([session({ sold: 60, date: '2026-09-11' })], { date: '2026-09-12' });
assert.equal(saturday.recommended_quantity, friday.recommended_quantity, 'Case H: weekday is context only until a labelled model validates a coefficient');

const compatiblePublic = { ...publicBenchmark, quantity_basis: 'per_session', estimate_quantity: 100, estimated_min: 90, estimated_max: 110, population_variance: 100 };
const caseI = calculate([session({ sold: 50 }), session({ sold: 70 }), session({ sold: 80 })], { publicBenchmark: compatiblePublic });
assert.ok(caseI.recommended_quantity > 67 && caseI.recommended_quantity < 100, 'Case I: compatible public session evidence should use data-derived partial pooling');

console.log('Public benchmark / personalization forecast verification passed: deterministic evidence-based Cases A–I.');
