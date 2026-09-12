const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function loadTypeScriptModule(filename) {
  const resolved = path.resolve(filename.endsWith('.ts') ? filename : `${filename}.ts`);
  const source = fs.readFileSync(resolved, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
  }).outputText;
  const module = { exports: {} };
  const scopedRequire = request => {
    if (!request.startsWith('.')) return require(request);
    return loadTypeScriptModule(path.resolve(path.dirname(resolved), request));
  };
  new Function('require', 'exports', 'module', output)(scopedRequire, module.exports, module);
  return module.exports;
}

const { extractSellingSetup, extractSellingSetupFollowUp, getMissingSetupFields, mergeSellingSetup } = loadTypeScriptModule('src/services/ai/sellingSetupExtraction.ts');

const complete = extractSellingSetup('I want to sell nasi ayam at Kampung Baru. I usually prepare around 100 packages. I sell each for RM8 and my cost is around RM4.');
assert.deepEqual(complete.missing, []);
assert.equal(complete.details.location_name, 'Kampung Baru');
assert.equal(complete.details.food_name, 'nasi ayam');
assert.equal(complete.details.quantity, 100);
assert.equal(complete.details.unit, 'packages');
assert.equal(complete.details.selling_price, 8);
assert.equal(complete.details.estimated_cost, 4);

const incomplete = extractSellingSetup('I want to sell nasi ayam at Kampung Baru. I usually prepare 100 packages.');
assert.deepEqual(incomplete.missing, ['selling_price', 'cost']);
assert.deepEqual(getMissingSetupFields(incomplete.details), ['selling_price', 'cost']);

const malay = extractSellingSetup('Saya mahu menjual nasi lemak di SS15. Saya biasanya sediakan 80 bungkus. Harga jual RM7 dan kos saya RM3.');
assert.deepEqual(malay.missing, []);
assert.equal(malay.details.food_name, 'nasi lemak');
assert.equal(malay.details.location_name, 'SS15');
assert.equal(malay.details.quantity, 80);
assert.equal(malay.details.selling_price, 7);
assert.equal(malay.details.estimated_cost, 3);

const locationFollowUp = extractSellingSetupFollowUp('Kampung Baru', ['location']);
assert.equal(locationFollowUp.location_name, 'Kampung Baru');
const foodFollowUp = extractSellingSetupFollowUp('nasi lemak', ['food']);
assert.equal(foodFollowUp.food_name, 'nasi lemak');
const pricesFollowUp = extractSellingSetupFollowUp('RM8 and RM4', ['selling_price', 'cost']);
assert.equal(pricesFollowUp.selling_price, 8);
assert.equal(pricesFollowUp.estimated_cost, 4);

const changedLocation = extractSellingSetup("I'm selling nasi lemak today at SS15. I prepare 80 packages, sell each for RM7, and my cost is RM3.");
assert.equal(changedLocation.details.food_name, 'nasi lemak');
assert.equal(changedLocation.details.location_name, 'SS15');
assert.deepEqual(changedLocation.missing, []);

const firstVoiceAnswer = extractSellingSetup("I'll sell nasi lemak at Kampung Baru this Saturday. I'll prepare around 100 packs.");
assert.equal(firstVoiceAnswer.details.location_name, 'Kampung Baru');
assert.equal(firstVoiceAnswer.details.food_name, 'nasi lemak');
assert.equal(firstVoiceAnswer.details.quantity, 100);
assert.equal(firstVoiceAnswer.details.unit, 'packs');
assert.match(firstVoiceAnswer.details.planned_date, /^20\d{2}-\d{2}-\d{2}$/);

const invalidQuantity = mergeSellingSetup(complete.details, { quantity: 0 });
assert.ok(getMissingSetupFields(invalidQuantity).includes('quantity'));

console.log('Selling setup extraction verification passed: complete, incomplete, Bahasa Melayu, first-voice date, follow-up, and change-location inputs are deterministic.');
