const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const moduleCache = new Map();
const writes = { recommendations: [], signals: [] };
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
  unit: 'bowls',
  baseline_quantity: 66,
  estimated_min: 65,
  estimated_max: 70,
  recommended_quantity: 68,
  total_adjustment: 0.03,
  comparable_strategy: 'same food and location',
  comparable_records: 3,
  confidence: { level: 'Medium', score: 60, comparable_records: 3, unavailable_context_signals: 0, detail: 'test' },
  signals: [{ kind: 'day_of_week', label: 'Weekend session', adjustment: 0.1, availability: 'available', detail: 'test' }],
  explanation_facts: ['3 comparable completed sessions averaged 66 bowls.'],
  low_data_message: null,
  weather: { availability: 'available', condition: 'clear', summary: 'test', source: 'test' },
  events: [],
  events_availability: 'available',
  price_insight: { availability: 'unavailable', summary: 'Price reference unavailable.', source_name: null, reference_url: null },
};

(async () => {
  const saved = await saveForecastResult('plan-1', 'food-1', baseResult);
  assert.deepEqual(saved, { data: { recommendationId: 'recommendation-1' }, error: null });
  assert.deepEqual(writes.recommendations[0], {
    selling_plan_id: 'plan-1', food_id: 'food-1', recommended_qty: 68, min_qty: 65, max_qty: 70,
    confidence: 60, reasoning: baseResult.explanation_facts[0], source: FORECAST_SOURCE,
  });
  assert.equal(writes.signals.length, 2, 'One structured signal and one forecast summary should persist');
  assert.equal(writes.signals[1].signal_type, 'forecast_summary');
  assert.equal(writes.signals[1].signal_data.baseline_quantity, 66);

  const noEstimate = { ...baseResult, is_estimate_available: false, baseline_quantity: null, estimated_min: null, estimated_max: null, recommended_quantity: null };
  const savedNoEstimate = await saveForecastResult('plan-2', 'food-1', noEstimate);
  assert.deepEqual(savedNoEstimate, { data: { recommendationId: null }, error: null });
  assert.equal(writes.recommendations.length, 1, 'Low-data flow must not write a fake zero-valued recommendation');
  assert.equal(writes.signals.at(-1).signal_data.status, 'insufficient_history');

  console.log('Forecast persistence verification passed: recommendations and external signals use the existing schema.');
})();
