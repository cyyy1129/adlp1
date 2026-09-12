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
  const source = fs.readFileSync(resolved, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
  }).outputText;
  const scopedRequire = request => {
    if (!request.startsWith('.')) return require(request);
    return loadTypeScriptModule(path.resolve(path.dirname(resolved), request));
  };
  const execute = new Function('require', 'exports', 'module', '__filename', '__dirname', output);
  execute(scopedRequire, module.exports, module, resolved, path.dirname(resolved));
  return module.exports;
}

const { calculateForecast } = loadTypeScriptModule('src/services/forecast/forecastEngine.ts');

const unavailablePrice = {
  availability: 'unavailable',
  summary: 'Price reference unavailable.',
  source_name: null,
  reference_url: null,
  item_name: null,
  unit: null,
  recent_price: null,
  price_date: null,
  sample_size: null,
};

function session({ sold, date = '2026-09-05', foodId = 'food-a', location = 'Kampar Night Market', crowd = 'Normal' }) {
  return {
    selling_plan_id: `plan-${date}-${sold}-${foodId}`,
    food_id: foodId,
    selling_date: date,
    location_name: location,
    prepared_quantity: sold + 10,
    leftover_quantity: 10,
    estimated_sold_quantity: sold,
    crowd_level: crowd,
  };
}

function context(history, date = '2026-09-12') {
  return {
    plan: {
      id: 'new-plan', user_id: 'user-1', plan_date: date, start_time: '17:00', end_time: '22:00',
      location_name: 'Kampar Night Market', latitude: null, longitude: null, status: 'confirmed', notes: null,
      created_at: '', updated_at: '',
    },
    item: { id: 'item-1', plan_id: 'new-plan', food_id: 'food-a', planned_qty: 0, unit_price: 0, created_at: '', updated_at: '' },
    food: { id: 'food-a', user_id: 'user-1', food_category: 'Noodles', food_name: 'Laksa', unit: 'bowls', avg_price: 0, created_at: '', updated_at: '' },
    historical_sessions: history,
  };
}

function calculate(history, overrides = {}) {
  return calculateForecast({
    context: context(history, overrides.date),
    weather: overrides.weather ?? {
      availability: 'available', condition: 'clear', summary: 'Verified clear condition.', source: 'test',
      temperature_c: 28, precipitation_probability: 0, precipitation_mm: 0, weather_code: 1,
      period_start: '2026-09-12T17:00', period_end: '2026-09-12T22:00',
    },
    events: overrides.events ?? [],
    eventsAvailability: overrides.eventsAvailability ?? 'available',
    priceInsight: overrides.priceInsight ?? unavailablePrice,
  });
}

const manyHistory = [60, 62, 64, 66, 68, 70].map(sold => session({ sold }));
const caseA = calculate(manyHistory, { events: [{ name: 'Food fair', distance_km: 2, starts_at: null, source: 'test', source_url: null }] });
assert.equal(caseA.is_estimate_available, true, 'Case A: history should produce an estimate');
assert.equal(caseA.recommended_quantity, 80, 'Case A: deterministic recommendation should use baseline + configured weights');
assert.equal(caseA.confidence.level, 'High', 'Case A: six comparable sessions should be High confidence');
assert.deepEqual(caseA, calculate(manyHistory, { events: [{ name: 'Food fair', distance_km: 2, starts_at: null, source: 'test', source_url: null }] }), 'Same input must be deterministic');

const caseB = calculate([]);
assert.equal(caseB.is_estimate_available, false, 'Case B: no history must not invent a quantity');
assert.equal(caseB.confidence.level, 'Low', 'Case B: no history should be Low confidence');

const caseC = calculate(manyHistory, { weather: {
  availability: 'unavailable', condition: null, summary: 'Unavailable', source: null,
  temperature_c: null, precipitation_probability: null, precipitation_mm: null, weather_code: null,
  period_start: null, period_end: null,
} });
assert.equal(caseC.is_estimate_available, true, 'Case C: unavailable weather must not stop the forecast');
assert.equal(caseC.signals.find(signal => signal.kind === 'weather').availability, 'unavailable');

const caseD = calculate(manyHistory, { eventsAvailability: 'unavailable' });
assert.equal(caseD.is_estimate_available, true, 'Case D: unavailable events must not stop the forecast');
assert.equal(caseD.signals.find(signal => signal.kind === 'nearby_event').availability, 'unavailable');

const caseE = calculate(manyHistory, { priceInsight: unavailablePrice });
assert.equal(caseE.price_insight.availability, 'unavailable', 'Case E: unavailable price data must be represented honestly');

const caseF = calculate([session({ sold: 50 }), session({ sold: 70 }), session({ sold: 80 })], {
  weather: {
    availability: 'available', condition: 'other', summary: 'Other', source: 'test',
    temperature_c: 28, precipitation_probability: 0, precipitation_mm: 0, weather_code: 3,
    period_start: '2026-09-12T17:00', period_end: '2026-09-12T22:00',
  },
});
assert.equal(caseF.baseline_quantity, 67, 'Case F: multiple sessions should average estimated sales');

const caseG = calculate([session({ sold: 90, foodId: 'food-b' })]);
assert.equal(caseG.is_estimate_available, false, 'Case G: another food must not become this food\'s baseline');

const friday = calculate([session({ sold: 60, date: '2026-09-11' })], {
  date: '2026-09-11', weather: {
    availability: 'available', condition: 'other', summary: 'Other', source: 'test',
    temperature_c: 28, precipitation_probability: 0, precipitation_mm: 0, weather_code: 3,
    period_start: '2026-09-11T17:00', period_end: '2026-09-11T22:00',
  },
});
const saturday = calculate([session({ sold: 60, date: '2026-09-11' })], {
  date: '2026-09-12', weather: {
    availability: 'available', condition: 'other', summary: 'Other', source: 'test',
    temperature_c: 28, precipitation_probability: 0, precipitation_mm: 0, weather_code: 3,
    period_start: '2026-09-12T17:00', period_end: '2026-09-12T22:00',
  },
});
assert.ok(saturday.recommended_quantity > friday.recommended_quantity, 'Case H: configured weekend factor should affect a different day');

console.log('Forecast engine verification passed: Cases A–H and deterministic repeatability.');
