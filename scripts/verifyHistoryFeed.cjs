const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function resultBuilder(result) {
  const builder = {
    select() { return builder; },
    eq() { return builder; },
    in() { return builder; },
    order() { return builder; },
    then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); },
  };
  return builder;
}

const supabaseStub = {
  from(table) {
    if (table === 'selling_plans') {
      return resultBuilder({
        data: [{ id: 'plan-1', user_id: 'user-1', plan_date: '2026-09-12', start_time: '17:00', end_time: '22:00', location_name: 'Kampar Night Market', latitude: null, longitude: null, status: 'completed', notes: null, created_at: '', updated_at: '' }],
        error: null,
      });
    }
    if (table === 'daily_checkins') {
      return resultBuilder({
        data: [{ id: 'checkin-1', user_id: 'user-1', selling_plan_id: 'plan-1', checkin_date: '2026-09-12', location_name: 'Kampar Night Market', prepared_quantity: 80, leftover_quantity: 12, estimated_sold_quantity: 999, unit: 'bowls', crowd_level: 'Normal', created_at: '', updated_at: '' }],
        error: null,
      });
    }
    if (table === 'selling_items') {
      return resultBuilder({ data: [{ id: 'item-1', plan_id: 'plan-1', food_id: 'food-1', planned_qty: 0, unit_price: 0, created_at: '', updated_at: '' }], error: null });
    }
    throw new Error(`Unexpected table: ${table}`);
  },
};

function loadTypeScriptModule(filename) {
  const resolved = path.resolve(filename.endsWith('.ts') ? filename : `${filename}.ts`);
  const source = fs.readFileSync(resolved, 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } }).outputText;
  const module = { exports: {} };
  const scopedRequire = request => {
    if (request === '../../lib/supabase') return { isSupabaseConfigured: true, supabase: supabaseStub };
    if (!request.startsWith('.')) return require(request);
    return loadTypeScriptModule(path.resolve(path.dirname(resolved), request));
  };
  new Function('require', 'exports', 'module', '__filename', '__dirname', output)(scopedRequire, module.exports, module, resolved, path.dirname(resolved));
  return module.exports;
}

const { getHistoricalSessions } = loadTypeScriptModule('src/services/forecast/forecastDataService.ts');

(async () => {
  const result = await getHistoricalSessions('user-1');
  assert.equal(result.error, null);
  assert.deepEqual(result.data, [{
    selling_plan_id: 'plan-1', food_id: 'food-1', selling_date: '2026-09-12', start_time: '17:00', end_time: '22:00', location_name: 'Kampar Night Market',
    prepared_quantity: 80, leftover_quantity: 12, estimated_sold_quantity: 68, unit: 'bowls', crowd_level: 'Normal',
  }]);
  console.log('Historical feed verification passed: completed user-owned check-ins become future forecast data.');
})();
