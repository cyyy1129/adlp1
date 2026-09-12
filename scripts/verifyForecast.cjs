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
const publicMarketContext = {
  availability: 'available', quantity_basis: 'not_convertible', estimate_quantity: null,
  estimated_min: null, estimated_max: null, sample_size: 0, population_variance: null,
  selected_scope: 'W.P. Kuala Lumpur', sales_value_per_stall: 33600, persons_engaged_per_stall: 2.9,
  serving_price: null, price_basis: null,
  methodology: 'Published bazaar market context.',
  limitation: 'Market-level value is not item-level per-session units sold.',
  sources: [{ source_id: 'dosm', name: 'DOSM test source', publisher: 'DOSM', source_url: 'https://example.test/dosm', license: null, coverage_start: null, coverage_end: null, retrieved_at: null, what_it_measures: 'market sales per stall', data_role: 'benchmark' }],
};

function session({ sold, date = '2026-09-05', foodId = 'food-a', location = 'Kampar Night Market', crowd = 'Normal', unit = 'bowls', start = '17:00', end = '22:00' }) {
  return {
    selling_plan_id: `plan-${date}-${sold}-${foodId}`,
    food_id: foodId,
    selling_date: date,
    start_time: start,
    end_time: end,
    location_name: location,
    prepared_quantity: sold + 10,
    leftover_quantity: 10,
    estimated_sold_quantity: sold,
    unit,
    crowd_level: crowd,
  };
}

function context(history, date = '2026-09-12', unit = 'bowls') {
  return {
    plan: { id: 'new-plan', user_id: 'user-1', plan_date: date, start_time: '17:00', end_time: '22:00', location_name: 'Kampar Night Market', latitude: null, longitude: null, status: 'confirmed', notes: null, created_at: '', updated_at: '' },
    item: { id: 'item-1', plan_id: 'new-plan', food_id: 'food-a', planned_qty: 0, unit_price: 8, created_at: '' },
    food: { id: 'food-a', user_id: 'user-1', food_category: 'Noodles', food_name: 'Laksa', unit, avg_price: 8, created_at: '' },
    seller_state: 'W.P. Kuala Lumpur', seller_city: null,
    historical_sessions: history,
  };
}

function calculate(history, overrides = {}) {
  return calculateForecast({
    context: context(history, overrides.date, overrides.unit),
    publicBenchmark: overrides.publicBenchmark ?? publicMarketContext,
    weather: overrides.weather ?? weather,
    historicalWeather: overrides.historicalWeather ?? historicalWeather,
    calendarContext: overrides.calendarContext ?? calendarContext,
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
assert.equal(caseB.source_type, 'insufficient_evidence', 'Case B: market-level public context must not be converted into food units');
assert.equal(caseB.recommended_quantity, null, 'Case B: no validated session-level target means no invented estimate');

const caseC = calculate([], { weather: { ...weather, availability: 'unavailable', condition: null, summary: 'Unavailable', source: null, temperature_c: null, precipitation_probability: null, precipitation_mm: null, weather_code: null, period_start: null, period_end: null } });
assert.equal(caseC.recommended_quantity, null, 'Case C: weather failure cannot create a numerical estimate');

const caseD = calculate([], { eventsAvailability: 'unavailable' });
assert.equal(caseD.recommended_quantity, null, 'Case D: event failure cannot create a numerical estimate');

const caseE = calculate([], { priceInsight: unavailablePrice });
assert.equal(caseE.recommended_quantity, null, 'Case E: missing PriceCatcher insight cannot create a numerical estimate');

const caseF = calculate([session({ sold: 50 }), session({ sold: 70 }), session({ sold: 80 })]);
assert.equal(caseF.baseline_quantity, 67, 'Case F: multiple check-ins should use their empirical mean');

const unavailableBenchmark = { ...publicMarketContext, availability: 'unavailable', limitation: 'No public data.', sources: [] };
const caseG = calculate([session({ sold: 90, foodId: 'food-b' })], { publicBenchmark: unavailableBenchmark });
assert.equal(caseG.is_estimate_available, false, 'Case G: another food cannot become this food’s personal basis');

const friday = calculate([session({ sold: 60, date: '2026-09-11' })], { date: '2026-09-11' });
const saturday = calculate([session({ sold: 60, date: '2026-09-11' })], { date: '2026-09-12' });
assert.equal(saturday.recommended_quantity, friday.recommended_quantity, 'Case H: weekday is context only until a labelled model validates a coefficient');

const compatiblePublic = {
  ...publicMarketContext,
  quantity_basis: 'per_session', estimate_quantity: 100, estimated_min: 90, estimated_max: 110,
  sample_size: 8, population_variance: 100,
  limitation: 'Validated per-session test fixture.',
};
const caseI = calculate([session({ sold: 50 }), session({ sold: 70 }), session({ sold: 80 })], { publicBenchmark: compatiblePublic });
assert.ok(caseI.recommended_quantity > 67 && caseI.recommended_quantity < 100, 'Case I: compatible public session evidence should use data-derived partial pooling');

const caseJ = calculate([session({ sold: 68, unit: 'bowls' })], { unit: 'serving' });
assert.equal(caseJ.recommended_quantity, 68, 'Case J: a generic onboarding unit must not hide a compatible check-in');
assert.equal(caseJ.unit, 'bowls', 'Case J: the estimate must retain the empirical check-in unit');

console.log('Forecast verification passed: deterministic seller-history estimates, no fabricated public conversion, and safe fallbacks.');
