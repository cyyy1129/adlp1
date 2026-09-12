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
  const source = fs.readFileSync(resolved, 'utf8').replaceAll('import.meta.env', '({})');
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

function response({ ok = true, status = 200, json, text, headers = {} }) {
  return {
    ok,
    status,
    headers: { get: key => headers[key.toLocaleLowerCase()] ?? null },
    async json() { return json; },
    async text() { return text ?? ''; },
  };
}

const originalFetch = global.fetch;
let weatherUnavailable = false;
global.fetch = async (url) => {
  const value = String(url);
  if (value.includes('archive-api.open-meteo.com')) {
    if (weatherUnavailable) throw new Error('Network unavailable');
    return response({
      json: {
        hourly: {
          time: ['2025-09-19T16:00', '2025-09-19T17:00', '2025-09-19T18:00', '2025-09-19T22:00'],
          temperature_2m: [30, 29, 28, 27], precipitation: [0, 0, 0.2, 1.1], weather_code: [1, 2, 61, 63],
        },
      },
    });
  }
  if (value.includes('api.open-meteo.com')) {
    if (weatherUnavailable) throw new Error('Network unavailable');
    return response({
      json: {
        hourly: {
          time: ['2026-09-19T16:00', '2026-09-19T17:00', '2026-09-19T18:00', '2026-09-19T22:00', '2026-09-19T23:00'],
          temperature_2m: [31, 30, 29, 28, 27],
          precipitation_probability: [10, 20, 70, 60, 0],
          precipitation: [0, 0, 0.2, 1.1, 0],
          weather_code: [1, 2, 61, 63, 1],
        },
      },
    });
  }
  if (value.endsWith('/lookup_item.csv')) {
    return response({ text: 'item_code,item,unit\n101,Rice,kg\n102,Chicken,piece\n' });
  }
  if (value.includes('pricecatcher_2026-09.csv')) {
    return response({
      status: 206,
      headers: { 'content-range': 'bytes 100-300/1000' },
      text: 'partial-row\n2026-09-10,1,101,3.20\n2026-09-10,2,101,3.80\n2026-09-09,2,101,4.00\n',
    });
  }
  if (value === 'https://events.example.test/search') return response({ json: { events: [] } });
  throw new Error(`Unexpected fetch: ${value}`);
};

const { OpenMeteoWeatherService } = loadTypeScriptModule('src/services/weather/weatherService.ts');
const { OpenMeteoHistoricalWeatherService } = loadTypeScriptModule('src/services/weather/historicalWeatherService.ts');
const { PriceCatcherPricingService } = loadTypeScriptModule('src/services/pricing/pricingService.ts');
const { RealEventService } = loadTypeScriptModule('src/services/events/eventService.ts');

(async () => {
  const weatherService = new OpenMeteoWeatherService();
  const weather = await weatherService.getForecast({
    date: '2026-09-19', start_time: '17:00', end_time: '22:00', latitude: 4.3, longitude: 101.1, location_name: 'Kampar',
  });
  assert.equal(weather.availability, 'available', 'A location and future date should return Open-Meteo data');
  assert.equal(weather.condition, 'rain');
  assert.equal(weather.temperature_c, 29);
  assert.equal(weather.precipitation_probability, 70);
  assert.equal(weather.precipitation_mm, 1.3);
  assert.equal(weather.weather_code, 61);

  const historicalWeather = await new OpenMeteoHistoricalWeatherService().getHistoricalContext({
    date: '2026-09-19', start_time: '17:00', end_time: '22:00', latitude: 4.3, longitude: 101.1, location_name: 'Kampar',
  });
  assert.equal(historicalWeather.availability, 'available', 'Historical Open-Meteo context should use the separate archive endpoint');
  assert.equal(historicalWeather.reference_date, '2025-09-19');
  assert.equal(historicalWeather.precipitation_mm, 1.3);

  weatherUnavailable = true;
  const unavailableWeather = await weatherService.getForecast({
    date: '2026-09-19', start_time: '17:00', end_time: '22:00', latitude: 4.3, longitude: 101.1, location_name: 'Kampar',
  });
  assert.equal(unavailableWeather.availability, 'unavailable', 'Weather failures must have a graceful fallback');
  weatherUnavailable = false;

  const eventResult = await new RealEventService('https://events.example.test/search').getNearbyEvents({
    date: '2026-09-19', start_time: '17:00', end_time: '22:00', latitude: 4.3, longitude: 101.1, location_name: 'Kampar',
  });
  assert.deepEqual(eventResult, { events: [], availability: 'available' }, 'An actual empty source result must not fabricate events');

  const pricingService = new PriceCatcherPricingService(() => new Date('2026-09-12T12:00:00Z'));
  const price = await pricingService.getInsight({ food_name: 'Rice', food_category: 'Staples', location_name: 'Kampar' });
  assert.equal(price.availability, 'available', 'Exact PriceCatcher item plus transaction rows should display a reference');
  assert.equal(price.item_name, 'Rice');
  assert.equal(price.unit, 'kg');
  assert.equal(price.recent_price, 3.5, 'The recent reference should use the median of actual newest-day records');
  assert.equal(price.price_date, '2026-09-10');

  const unavailablePrice = await pricingService.getInsight({ food_name: 'Laksa', food_category: 'Noodles', location_name: 'Kampar' });
  assert.equal(unavailablePrice.availability, 'unavailable', 'An unmatched item must not receive an invented price');

  console.log('External data verification passed: Open-Meteo forecast/history fallbacks, actual empty event result, and PriceCatcher reference/fallback.');
})()
  .finally(() => { global.fetch = originalFetch; })
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
