const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const writes = { checkin: null, conflict: null, planUpdate: null, planFilters: [] };
const supabaseStub = {
  from(table) {
    if (table === 'selling_plans') {
      let mode = 'select';
      const builder = {
        select() { mode = 'select'; return builder; },
        update(value) { mode = 'update'; writes.planUpdate = value; return builder; },
        eq(field, value) { writes.planFilters.push([mode, field, value]); return builder; },
        async maybeSingle() { return { data: { id: 'plan-1', status: 'confirmed' }, error: null }; },
        then(resolve, reject) { return Promise.resolve({ data: null, error: null }).then(resolve, reject); },
      };
      return builder;
    }
    if (table === 'daily_checkins') {
      const builder = {
        upsert(value, options) { writes.checkin = value; writes.conflict = options.onConflict; return builder; },
        select() { return builder; },
        async single() { return { data: { ...writes.checkin, id: 'checkin-1', created_at: '', updated_at: '' }, error: null }; },
        eq() { return builder; },
        async maybeSingle() { return { data: null, error: null }; },
      };
      return builder;
    }
    throw new Error(`Unexpected table: ${table}`);
  },
};

function loadTypeScriptModule(filename) {
  const resolved = path.resolve(filename.endsWith('.ts') ? filename : `${filename}.ts`);
  const source = fs.readFileSync(resolved, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
  }).outputText;
  const module = { exports: {} };
  const scopedRequire = request => {
    if (request === '../lib/supabase') return { isSupabaseConfigured: true, supabase: supabaseStub };
    if (!request.startsWith('.')) return require(request);
    return loadTypeScriptModule(path.resolve(path.dirname(resolved), request));
  };
  new Function('require', 'exports', 'module', '__filename', '__dirname', output)(scopedRequire, module.exports, module, resolved, path.dirname(resolved));
  return module.exports;
}

const { getEstimatedSold, saveDailyCheckin } = loadTypeScriptModule('src/services/checkinService.ts');
const { getHistoryReflection } = loadTypeScriptModule('src/services/historyService.ts');

(async () => {
  assert.equal(getEstimatedSold(80, 12), 68);
  assert.equal(getEstimatedSold(12, 80), 0, 'Estimated sold must never be negative');

  const saved = await saveDailyCheckin({
    user_id: 'user-1', selling_plan_id: 'plan-1', checkin_date: '2026-09-12', location_name: 'Kampar Night Market',
    prepared_quantity: 80, leftover_quantity: 12, unit: 'bowls', crowd_level: 'Normal',
  });
  assert.equal(saved.error, null);
  assert.equal(saved.data.estimated_sold_quantity, 68);
  assert.equal(writes.checkin.estimated_sold_quantity, 68);
  assert.equal(writes.conflict, 'user_id,selling_plan_id', 'Check-ins must be idempotent per user and plan');
  assert.equal(writes.planUpdate.status, 'completed');

  writes.checkin = null;
  const invalid = await saveDailyCheckin({
    user_id: 'user-1', selling_plan_id: 'plan-1', checkin_date: '2026-09-12', location_name: 'Kampar Night Market',
    prepared_quantity: 12, leftover_quantity: 80, unit: 'bowls', crowd_level: 'Normal',
  });
  assert.match(invalid.error, /cannot be more/i);
  assert.equal(writes.checkin, null, 'Invalid input must not be written');

  const reflection = getHistoryReflection([
    { selling_plan_id: 'a', selling_date: '2026-09-05', location_name: 'Market', food_name: 'Laksa', prepared_quantity: 80, leftover_quantity: 12, estimated_sold_quantity: 68, unit: 'bowls', crowd_level: 'Normal' },
    { selling_plan_id: 'b', selling_date: '2026-09-12', location_name: 'Market', food_name: 'Laksa', prepared_quantity: 82, leftover_quantity: 14, estimated_sold_quantity: 68, unit: 'bowls', crowd_level: 'Packed' },
  ]);
  assert.equal(reflection, 'Your previous Saturday sessions averaged 68 bowls sold.');

  console.log('Daily check-in verification passed: validation, non-negative sales, idempotent save, plan completion, and data-backed reflection.');
})();
