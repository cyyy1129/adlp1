/*
 * Reproducible importer for the validated public-data cold-start layer.
 *
 * Run with a server-only Supabase key (never VITE_):
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run import:public-data
 *
 * This script downloads and parses official source files. It does not contain
 * copied market statistics or price values. If the source layout changes, it
 * fails validation instead of uploading guessed values.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import XLSX from 'xlsx';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { createClient } from '@supabase/supabase-js';

const DOSM_BAZAAR_WORKBOOK_URL = 'https://www.dosm.gov.my/portal-main/release-document-log?release_document_id=14739';
const DOSM_BAZAAR_RELEASE_URL = 'https://www.dosm.gov.my/portal-main/release-content/statistics-on-ramadan-and-aidilfitri-bazaars-malaysia-2025';
const DOSM_PRICE_PDF_URL = 'https://www.dosm.gov.my/uploads/content-downloads/file_20260406092417.pdf';

function normalise(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

function number(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function findHeaderColumn(header, matcher) {
  const index = header.findIndex(value => typeof value === 'string' && matcher(value));
  if (index < 0) throw new Error('The official workbook layout changed: a required column was not found.');
  return index;
}

function findYearRow(rows, headerRowIndex) {
  const index = rows.findIndex((row, rowIndex) => rowIndex > headerRowIndex
    && row.filter(value => [2022, 2023, 2025].includes(Number(value))).length >= 3);
  if (index < 0) throw new Error('The official workbook layout changed: the 2022/2023/2025 year row was not found.');
  return index;
}

function measureColumns(rows, headerRowIndex) {
  const header = rows[headerRowIndex];
  const yearRow = rows[findYearRow(rows, headerRowIndex)];
  const stallsStart = findHeaderColumn(header, value => /Number of business stalls/i.test(value));
  const peopleStart = findHeaderColumn(header, value => /persons engaged/i.test(value));
  const salesStart = findHeaderColumn(header, value => /Sales value/i.test(value));
  const indexFor = (start, year) => {
    const index = yearRow.findIndex((value, position) => position >= start && Number(value) === year);
    if (index < 0) throw new Error(`The official workbook layout changed: ${year} values were not found.`);
    return index;
  };
  return {
    dataStart: findYearRow(rows, headerRowIndex) + 1,
    yearColumns: [2022, 2023, 2025].map(year => ({
      year,
      stalls: indexFor(stallsStart, year),
      persons: indexFor(peopleStart, year),
      sales: indexFor(salesStart, year),
    })),
  };
}

function recordFor({ state, district = null, locationName = null, bazaarType, placeKey, year, stalls, persons, sales }) {
  if (!state || stalls === null || stalls <= 0 || sales === null || sales < 0) return null;
  // DOSM labels the source sales column RM'000. Store ringgit, and retain the
  // conversion in metric_definition so it is fully auditable.
  const salesValue = sales * 1000;
  return {
    year,
    bazaar_type: bazaarType,
    state,
    district,
    location_name: locationName,
    place_key: placeKey,
    stall_count: stalls,
    sales_value: salesValue,
    persons_engaged: persons,
    sales_value_per_stall: salesValue / stalls,
    persons_engaged_per_stall: persons === null ? null : persons / stalls,
    metric_definition: "DOSM published sales value (RM'000) × 1,000 ÷ number of business stalls. This is a market-level revenue-per-stall benchmark, not item-level units sold.",
    is_item_level_target: false,
  };
}

function extractStateTable(workbook, sheetName, bazaarType) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`Official workbook sheet '${sheetName}' is missing.`);
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
  const headerRowIndex = rows.findIndex(row => row.some(value => typeof value === 'string' && /Number of business stalls/i.test(value)));
  if (headerRowIndex < 0) throw new Error(`Official workbook sheet '${sheetName}' has no stalls header.`);
  const { dataStart, yearColumns } = measureColumns(rows, headerRowIndex);
  const records = [];
  for (const row of rows.slice(dataStart)) {
    const state = typeof row[0] === 'string' ? row[0].trim() : '';
    if (!state) continue;
    for (const columns of yearColumns) {
      const record = recordFor({
        state,
        bazaarType,
        placeKey: normalise(state),
        year: columns.year,
        stalls: number(row[columns.stalls]),
        persons: number(row[columns.persons]),
        sales: number(row[columns.sales]),
      });
      if (record) records.push(record);
    }
  }
  return records;
}

function isStateCode(value) {
  return typeof value === 'number' || (typeof value === 'string' && /^(?:[1-9]|1[0-6])$/.test(value.trim()));
}

function extractCombinedDistrictTables(workbook) {
  const sheetNames = workbook.SheetNames.filter(name => name === 'Jadual 1.1' || name.startsWith('Jadual 1.1 '));
  if (sheetNames.length === 0) throw new Error('Official workbook district sheets are missing.');
  const records = [];
  let activeState = null;
  for (const sheetName of sheetNames) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: null, raw: true });
    const headerRowIndex = rows.findIndex(row => row.some(value => typeof value === 'string' && /State\/District/i.test(value)));
    if (headerRowIndex < 0) throw new Error(`Official workbook district sheet '${sheetName}' has no State/District header.`);
    const header = rows[headerRowIndex];
    const labelIndex = findHeaderColumn(header, value => /State\/District/i.test(value));
    const codeIndex = findHeaderColumn(header, value => /Code/i.test(value));
    const { dataStart, yearColumns } = measureColumns(rows, headerRowIndex);
    for (const row of rows.slice(dataStart)) {
      const label = typeof row[labelIndex] === 'string' ? row[labelIndex].trim() : '';
      const code = row[codeIndex];
      if (!label) continue;
      if (label === 'Malaysia' || isStateCode(code)) {
        activeState = label;
        continue;
      }
      if (!activeState) continue;
      for (const columns of yearColumns) {
        const record = recordFor({
          state: activeState,
          district: label,
          bazaarType: 'ramadan_and_aidilfitri',
          placeKey: `${normalise(activeState)}:${normalise(label)}`,
          year: columns.year,
          stalls: number(row[columns.stalls]),
          persons: number(row[columns.persons]),
          sales: number(row[columns.sales]),
        });
        if (record) records.push(record);
      }
    }
  }
  return records;
}

export function parseDosmBazaarWorkbook(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', raw: true });
  const rows = [
    ...extractStateTable(workbook, 'Jadual 1', 'ramadan_and_aidilfitri'),
    ...extractStateTable(workbook, 'Jadual 2', 'ramadan'),
    ...extractStateTable(workbook, 'Jadual 3', 'aidilfitri'),
    ...extractCombinedDistrictTables(workbook),
  ];
  if (rows.length < 100) throw new Error(`Workbook validation failed: expected a substantial set of official benchmark rows, received ${rows.length}.`);
  return rows;
}

export async function parseDosmPricePdf(buffer) {
  const { text } = await pdfParse(buffer);
  const start = text.indexOf('\nAyamGolek');
  const end = start >= 0 ? text.indexOf('\n4\n', start) : -1;
  if (start < 0 || end < 0) throw new Error('DOSM 2026 price PDF layout changed: the Ramadan Malaysia item-price section was not found.');
  const priceSection = text.slice(start, end);
  const matches = [...priceSection.matchAll(/(?:^|\n)([^\n\r]+?)\s*\r?\nRM\s?(\d+(?:\.\d+)?)\s*\r?\n\/([^\n\r]+?)\s*\r?\n2025:/g)];
  // The publication itself describes 20 selected Ramadan items. Requiring all
  // 20 prevents a partial/shifted PDF extraction from becoming fake data.
  if (matches.length !== 20) throw new Error(`DOSM 2026 price PDF validation failed: expected 20 selected Ramadan items, received ${matches.length}.`);
  return matches.map(match => ({
    year: 2026,
    state: null,
    place_key: 'malaysia',
    normalized_food_name: normalise(match[1]),
    display_name: match[1].trim(),
    unit: match[3].trim(),
    average_price: Number(match[2]),
    location_scope: 'Malaysia',
    is_demand_target: false,
  }));
}

async function fetchBuffer(url) {
  const response = await fetch(url, { headers: { Accept: 'application/octet-stream, application/pdf, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' } });
  if (!response.ok) throw new Error(`Download failed (${response.status}) for ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

async function upsertSource(supabase, row) {
  const { data, error } = await supabase.from('data_sources').upsert(row, { onConflict: 'source_key' }).select('id').single();
  if (error || !data) throw new Error(error?.message ?? `Could not upsert data source ${row.source_key}.`);
  return data.id;
}

async function upsertInBatches(supabase, table, rows, conflictTarget) {
  const batchSize = 250;
  for (let index = 0; index < rows.length; index += batchSize) {
    const { error } = await supabase.from(table).upsert(rows.slice(index, index + batchSize), { onConflict: conflictTarget });
    if (error) throw new Error(`Could not import ${table}: ${error.message}`);
  }
}

async function runImport() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY are required. The service role key must stay server-side.');
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const [workbookBuffer, pricePdfBuffer] = await Promise.all([fetchBuffer(DOSM_BAZAAR_WORKBOOK_URL), fetchBuffer(DOSM_PRICE_PDF_URL)]);
  const [benchmarks, prices] = await Promise.all([Promise.resolve(parseDosmBazaarWorkbook(workbookBuffer)), parseDosmPricePdf(pricePdfBuffer)]);
  const retrievedAt = new Date().toISOString();

  const bazaarSourceId = await upsertSource(supabase, {
    source_key: 'dosm_ramadan_aidilfitri_bazaar_statistics_2025_workbook',
    name: 'DOSM Statistics on Ramadan and Aidilfitri Bazaars Malaysia 2025 workbook',
    publisher: 'Department of Statistics Malaysia (DOSM)',
    source_url: DOSM_BAZAAR_RELEASE_URL,
    license: null,
    coverage_start: '2022-01-01',
    coverage_end: '2025-12-31',
    source_type: 'public_benchmark',
    validation_status: 'validated',
    retrieved_at: retrievedAt,
    notes: {
      what_it_measures: 'State and administrative-district counts of bazaar stalls, persons engaged, and total sales value for Ramadan and Aidilfitri bazaars. It does not measure item-level units sold or individual-session demand.',
      source_file: DOSM_BAZAAR_WORKBOOK_URL,
      sales_unit_in_source: "RM'000",
      ingestion: 'Programmatically downloaded and parsed by scripts/importPublicForecastData.mjs',
    },
  });
  const priceSourceId = await upsertSource(supabase, {
    source_key: 'dosm_selected_bazaar_item_prices_2026_pdf',
    name: 'DOSM Average Prices of Selected Bazaar Items 2026',
    publisher: 'Department of Statistics Malaysia (DOSM)',
    source_url: DOSM_PRICE_PDF_URL,
    license: null,
    coverage_start: '2026-02-19',
    coverage_end: '2026-03-10',
    source_type: 'price_reference',
    validation_status: 'validated',
    retrieved_at: retrievedAt,
    notes: {
      what_it_measures: 'Average transaction/retail prices for selected Ramadan and Aidilfitri bazaar items. It is a price reference, not prepared-food units sold or a demand label.',
      ingestion: 'Programmatically downloaded and parser-validated by scripts/importPublicForecastData.mjs',
      parser_validation: 'Exactly 20 selected Malaysia Ramadan items are required before import.',
    },
  });

  await upsertInBatches(supabase, 'public_bazaar_benchmarks', benchmarks.map(row => ({ ...row, source_id: bazaarSourceId })), 'source_id,year,bazaar_type,place_key');
  await upsertInBatches(supabase, 'public_item_prices', prices.map(row => ({ ...row, source_id: priceSourceId })), 'source_id,year,place_key,normalized_food_name,unit');
  const { error: modelError } = await supabase.from('model_versions').upsert({
    model_name: 'public_benchmark_empirical_estimator',
    version: '2.0.0',
    methodology: 'Public market sales-per-stall benchmark with explicit revenue-equivalent conversion when a verified per-serving denominator is present. Private seller check-ins are used only for user-scoped empirical calibration. Weather, events, holidays and transit remain context-only without labelled-demand validation.',
    feature_definition: {
      numerical_basis: ['DOSM sales_value_per_stall', 'verified per-serving price', 'private completed check-ins when present'],
      context_only: ['weekday', 'weather', 'events', 'holiday', 'Rapid Rail OD activity proxy'],
    },
    evaluation_metrics: {},
    source_ids: [bazaarSourceId, priceSourceId],
  }, { onConflict: 'model_name,version' });
  if (modelError) throw new Error(`Could not register model version: ${modelError.message}`);

  console.log(`Imported ${benchmarks.length} DOSM bazaar benchmark rows and ${prices.length} DOSM selected-item price rows.`);
}

async function runLocalValidation() {
  const workbookPath = process.argv[3];
  const pricePath = process.argv[4];
  if (!workbookPath || !pricePath) throw new Error('Usage: node scripts/importPublicForecastData.mjs --validate-local <workbook.xlsx> <price.pdf>');
  const [workbook, pricePdf] = await Promise.all([fs.readFile(path.resolve(workbookPath)), fs.readFile(path.resolve(pricePath))]);
  const benchmarks = parseDosmBazaarWorkbook(workbook);
  const prices = await parseDosmPricePdf(pricePdf);
  console.log(`Validated ${benchmarks.length} benchmark rows and ${prices.length} selected-item prices from official local files.`);
}

if (process.argv[2] === '--validate-local') {
  runLocalValidation().catch(error => { console.error(error.message); process.exitCode = 1; });
} else {
  runImport().catch(error => { console.error(error.message); process.exitCode = 1; });
}
