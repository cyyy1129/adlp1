// ============================================================
// Malaysia PriceCatcher integration.
//
// PriceCatcher publishes an official item lookup plus raw transactional price
// records. It is a consumer/market reference, never a prepared-food menu-price
// source. The service only returns an insight after an exact item match and
// actual transaction rows have both been found.
// ============================================================

import type { PriceInsight } from '../../types/forecast';

export interface PricingRequest {
  food_name: string;
  food_category: string;
  location_name: string | null;
}

export interface PricingService {
  getInsight(request: PricingRequest): Promise<PriceInsight>;
}

interface PriceCatcherItem {
  item_code: string;
  item: string;
  unit: string | null;
}

interface PriceRecord {
  date: string;
  item_code: string;
  price: number;
}

const PRICECATCHER_CATALOGUE_URL = 'https://data.gov.my/data-catalogue/pricecatcher';
const PRICECATCHER_ITEM_LOOKUP_URL = 'https://storage.data.gov.my/pricecatcher/lookup_item.csv';
const PRICECATCHER_STORAGE_ROOT = 'https://storage.data.gov.my/pricecatcher';
const TAIL_BYTES = 512 * 1024;
const MAX_SAFE_FULL_FILE_BYTES = 1_500_000;

let itemLookupPromise: Promise<PriceCatcherItem[]> | null = null;

function unavailable(): PriceInsight {
  return {
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
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      values.push(value.trim());
      value = '';
    } else {
      value += character;
    }
  }
  values.push(value.trim());
  return values;
}

function normaliseHeader(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/^\ufeff/, '');
}

function parseItemLookup(csv: string): PriceCatcherItem[] {
  const lines = csv.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map(normaliseHeader);
  const codeIndex = headers.indexOf('item_code');
  const itemIndex = headers.indexOf('item');
  const unitIndex = headers.indexOf('unit');
  if (codeIndex < 0 || itemIndex < 0) return [];

  return lines.slice(1).flatMap(line => {
    const fields = parseCsvLine(line);
    const item_code = fields[codeIndex]?.trim();
    const item = fields[itemIndex]?.trim();
    if (!item_code || !item) return [];
    return [{ item_code, item, unit: fields[unitIndex]?.trim() || null }];
  });
}

function normaliseItemName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function findExactItem(items: PriceCatcherItem[], foodName: string): PriceCatcherItem | null {
  const normalisedFood = normaliseItemName(foodName);
  if (!normalisedFood) return null;
  return items.find(item => normaliseItemName(item.item) === normalisedFood) ?? null;
}

function monthKey(now: Date): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

function parsePriceRows(csv: string, itemCode: string, startsMidFile: boolean): PriceRecord[] {
  const lines = csv.split(/\r?\n/).filter(Boolean);
  if (startsMidFile) lines.shift();
  if (lines.length === 0) return [];
  const first = parseCsvLine(lines[0]).map(normaliseHeader);
  const hasHeader = first.includes('date') && first.includes('item_code') && first.includes('price');
  const headers = hasHeader ? first : ['date', 'premise_code', 'item_code', 'price'];
  const dataLines = hasHeader ? lines.slice(1) : lines;
  const dateIndex = headers.indexOf('date');
  const itemCodeIndex = headers.indexOf('item_code');
  const priceIndex = headers.indexOf('price');
  if (dateIndex < 0 || itemCodeIndex < 0 || priceIndex < 0) return [];

  return dataLines.flatMap(line => {
    const fields = parseCsvLine(line);
    const date = fields[dateIndex]?.trim();
    const code = fields[itemCodeIndex]?.trim();
    const price = Number(fields[priceIndex]);
    if (!date || code !== itemCode || !Number.isFinite(price) || price < 0) return [];
    return [{ date, item_code: code, price }];
  });
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

async function loadItemLookup(): Promise<PriceCatcherItem[]> {
  if (!itemLookupPromise) {
    itemLookupPromise = fetch(PRICECATCHER_ITEM_LOOKUP_URL, { headers: { Accept: 'text/csv' } })
      .then(async response => response.ok ? parseItemLookup(await response.text()) : [])
      .catch(() => []);
  }
  return itemLookupPromise;
}

async function loadRecentRecords(itemCode: string, now: Date): Promise<PriceRecord[]> {
  const dataUrl = `${PRICECATCHER_STORAGE_ROOT}/pricecatcher_${monthKey(now)}.csv`;
  try {
    const response = await fetch(dataUrl, {
      headers: { Accept: 'text/csv', Range: `bytes=-${TAIL_BYTES}` },
    });
    if (!response.ok) return [];
    const isPartialResponse = response.status === 206 || Boolean(response.headers.get('content-range'));
    const contentLength = Number(response.headers.get('content-length'));
    if (!isPartialResponse && (!Number.isFinite(contentLength) || contentLength > MAX_SAFE_FULL_FILE_BYTES)) return [];
    return parsePriceRows(await response.text(), itemCode, isPartialResponse);
  } catch {
    return [];
  }
}

export class PriceCatcherPricingService implements PricingService {
  private readonly now: () => Date;

  constructor(now: () => Date = () => new Date()) {
    this.now = now;
  }

  async getInsight(request: PricingRequest): Promise<PriceInsight> {
    const [items] = await Promise.all([loadItemLookup()]);
    const item = findExactItem(items, request.food_name);
    if (!item) return unavailable();

    const records = await loadRecentRecords(item.item_code, this.now());
    if (records.length === 0) return unavailable();
    const newestDate = records.reduce((latest, record) => record.date > latest ? record.date : latest, records[0].date);
    const newestRecords = records.filter(record => record.date === newestDate);
    if (newestRecords.length === 0) return unavailable();
    const recent_price = roundCurrency(median(newestRecords.map(record => record.price)));
    const unit = item.unit;
    const unitText = unit ? ` per ${unit}` : '';

    return {
      availability: 'available',
      summary: `Recent Malaysia PriceCatcher consumer-market reference: RM ${recent_price.toFixed(2)}${unitText}, based on ${newestRecords.length} observed record${newestRecords.length === 1 ? '' : 's'} on ${newestDate}. This is not a prepared-food selling price.`,
      source_name: 'Malaysia PriceCatcher / data.gov.my',
      reference_url: PRICECATCHER_CATALOGUE_URL,
      item_name: item.item,
      unit,
      recent_price,
      price_date: newestDate,
      sample_size: newestRecords.length,
    };
  }
}

export function getPricingService(): PricingService {
  return new PriceCatcherPricingService();
}
