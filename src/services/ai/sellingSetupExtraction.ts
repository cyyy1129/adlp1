// ============================================================
// Deterministic extraction for the one-shot seller setup answer.
// This is intentionally local and transparent: it only returns details that
// are present in the spoken/typed sentence, and never invents a value.
// ============================================================

import { extractDate } from './extraction';

export type SellingSetupField = 'location' | 'food' | 'quantity' | 'selling_price' | 'cost';

export interface SellingSetupDetails {
  location_name: string | null;
  food_name: string | null;
  quantity: number | null;
  unit: string | null;
  selling_price: number | null;
  estimated_cost: number | null;
  // A date is useful session context for the first voice response. It stays
  // optional because a dated selling_plan is still created explicitly in the
  // planning flow, rather than silently creating a session here.
  planned_date: string | null;
}

export interface SellingSetupExtraction {
  details: SellingSetupDetails;
  missing: SellingSetupField[];
}

const EMPTY_DETAILS: SellingSetupDetails = {
  location_name: null,
  food_name: null,
  quantity: null,
  unit: null,
  selling_price: null,
  estimated_cost: null,
  planned_date: null,
};

function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').replace(/[.]+$/, '').trim();
}

function numberFrom(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(/,/g, ''));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function cleanFood(value: string | undefined): string | null {
  if (!value) return null;
  const cleaned = cleanText(value)
    .replace(/^(?:some|a|an|the)\s+/i, '')
    .replace(/\b(?:today|this morning|tonight)\b.*$/i, '')
    .trim();
  return cleaned.length > 1 ? cleaned : null;
}

function extractFood(input: string): string | null {
  const patterns = [
    /\b(?:want to|will|going to|plan to|nak|mahu|akan|saya)\s*(?:sell|selling|jual|menjual)\s+(.+?)\s+(?:at|di|near|dekat)\s+/i,
    /\b(?:sell|selling|jual|menjual)\s+(.+?)(?=\s+(?:at|di|near|dekat|for|around|dengan)\s+|[.,]|$)/i,
  ];
  for (const pattern of patterns) {
    const match = input.match(pattern);
    const food = cleanFood(match?.[1]);
    if (food) return food;
  }
  return null;
}

function extractLocation(input: string): string | null {
  const patterns = [
    /\b(?:at|near)\s+(.+?)(?=[.,]|\s+(?:this|next|today|tomorrow|on|hari\s+ini|esok|sabtu|ahad|isnin|selasa|rabu|khamis|jumaat)\b|\s+(?:i|we|saya|kami)\s+(?:usually|will|prepare|sell|biasanya|akan|sediakan|jual)|$)/i,
    /\bdi\s+(.+?)(?=[.,]|\s+(?:ini|esok|sabtu|ahad|isnin|selasa|rabu|khamis|jumaat)\b|\s+(?:saya|kami)\s+(?:biasanya|akan|sediakan|jual)|$)/i,
    /\bdekat\s+(.+?)(?=[.,]|\s+(?:ini|esok|sabtu|ahad|isnin|selasa|rabu|khamis|jumaat)\b|\s+(?:saya|kami)\s+(?:biasanya|akan|sediakan|jual)|$)/i,
  ];
  for (const pattern of patterns) {
    const match = input.match(pattern);
    const location = cleanText(match?.[1] ?? '');
    if (location.length > 1 && !/^rm\s*\d/i.test(location)) return location;
  }
  return null;
}

function extractQuantity(input: string): Pick<SellingSetupDetails, 'quantity' | 'unit'> {
  const unitMatch = input.match(/\b(?:prepare|prepared|usually prepare|sell|jual|sediakan|biasanya sediakan)\s*(?:around|about|lebih kurang|kira-kira)?\s*(\d+(?:\.\d+)?)\s*(packages?|packs?|portions?|servings?|bowls?|pieces?|pcs|sets?|kg|kilograms?|litres?|liters?|bungkus|pek|set|mangkuk|biji)\b/i)
    ?? input.match(/\b(\d+(?:\.\d+)?)\s*(packages?|packs?|portions?|servings?|bowls?|pieces?|pcs|sets?|kg|kilograms?|litres?|liters?|bungkus|pek|set|mangkuk|biji)\b/i);
  if (unitMatch) return { quantity: numberFrom(unitMatch[1]), unit: cleanText(unitMatch[2]).toLocaleLowerCase() };

  const quantityMatch = input.match(/\b(?:prepare|prepared|usually prepare|jual|sediakan|biasanya sediakan)\s*(?:around|about|lebih kurang|kira-kira)?\s*(\d+(?:\.\d+)?)(?!\s*(?:rm|ringgit))/i);
  return { quantity: numberFrom(quantityMatch?.[1]), unit: null };
}

function extractMoney(input: string, kind: 'price' | 'cost'): number | null {
  const patterns = kind === 'cost'
    ? [
      /\b(?:my\s+)?cost(?:\s+is|\s+around|\s+about|\s+per\s+(?:item|package|portion))?\s*(?:is|at|around|about)?\s*(?:rm|ringgit)\s*(\d+(?:\.\d+)?)/i,
      /\b(?:kos|modal)(?:\s+saya)?(?:\s+adalah|\s+sekitar|\s+lebih kurang|\s+per\s+(?:item|bungkus|hidangan))?\s*(?:rm|ringgit)\s*(\d+(?:\.\d+)?)/i,
    ]
    : [
      /\b(?:selling\s+price|price|harga\s+jualan|harga)\s*(?:is|at|around|about)?\s*(?:rm|ringgit)\s*(\d+(?:\.\d+)?)/i,
      /\b(?:sell|jual)(?:\s+(?:each|per\s+(?:item|package|portion|bungkus|hidangan)))?\s*(?:for|at|pada)?\s*(?:rm|ringgit)\s*(\d+(?:\.\d+)?)/i,
      /\b(?:rm|ringgit)\s*(\d+(?:\.\d+)?)\s*(?:each|per\s+(?:item|package|portion|bungkus|hidangan|set))/i,
    ];
  for (const pattern of patterns) {
    const amount = numberFrom(input.match(pattern)?.[1]);
    if (amount !== null) return amount;
  }
  return null;
}

export function extractSellingSetup(input: string): SellingSetupExtraction {
  const normalized = cleanText(input);
  const quantity = extractQuantity(normalized);
  const details: SellingSetupDetails = {
    location_name: extractLocation(normalized),
    food_name: extractFood(normalized),
    quantity: quantity.quantity,
    unit: quantity.unit,
    selling_price: extractMoney(normalized, 'price'),
    estimated_cost: extractMoney(normalized, 'cost'),
    planned_date: extractDate(normalized),
  };
  const missing: SellingSetupField[] = [];
  if (!details.location_name) missing.push('location');
  if (!details.food_name) missing.push('food');
  if (details.quantity === null || details.quantity <= 0 || !details.unit) missing.push('quantity');
  if (details.selling_price === null) missing.push('selling_price');
  if (details.estimated_cost === null) missing.push('cost');
  return { details, missing };
}

export function extractSellingHistory(input: string): Pick<SellingSetupDetails, 'food_name' | 'quantity' | 'unit' | 'selling_price' | 'estimated_cost'> {
  const extracted = extractSellingSetup(input).details;
  return {
    food_name: extracted.food_name,
    quantity: extracted.quantity,
    unit: extracted.unit,
    selling_price: extracted.selling_price,
    estimated_cost: extracted.estimated_cost,
  };
}

export function mergeSellingSetup(base: SellingSetupDetails, next: Partial<SellingSetupDetails>): SellingSetupDetails {
  return {
    location_name: next.location_name ?? base.location_name,
    food_name: next.food_name ?? base.food_name,
    quantity: next.quantity ?? base.quantity,
    unit: next.unit ?? base.unit,
    selling_price: next.selling_price ?? base.selling_price,
    estimated_cost: next.estimated_cost ?? base.estimated_cost,
    planned_date: next.planned_date ?? base.planned_date,
  };
}

/**
 * Follow-up replies are often deliberately short (for example, “Kampung
 * Baru” or “RM8 and RM4”). This adds only details implied by the question
 * we just asked; it never guesses values for fields that were not requested.
 */
export function extractSellingSetupFollowUp(input: string, requested: SellingSetupField[]): Partial<SellingSetupDetails> {
  const full = extractSellingSetup(input).details;
  const response: Partial<SellingSetupDetails> = { ...full };
  const clean = cleanText(input);

  if (requested.length === 1 && requested[0] === 'location' && !response.location_name) {
    response.location_name = clean.length > 1 ? clean : null;
  }
  if (requested.length === 1 && requested[0] === 'food' && !response.food_name) {
    response.food_name = cleanFood(clean);
  }

  const amounts = Array.from(clean.matchAll(/(?:rm|ringgit)\s*(\d+(?:\.\d+)?)/gi))
    .map(match => numberFrom(match[1]))
    .filter((value): value is number => value !== null);
  if (requested.includes('selling_price') && response.selling_price === null && amounts.length > 0) {
    response.selling_price = amounts[0];
  }
  if (requested.includes('cost') && response.estimated_cost === null && amounts.length > 0) {
    response.estimated_cost = requested.includes('selling_price') && amounts.length > 1 ? amounts[1] : amounts.at(-1)!;
  }

  return response;
}

export function getMissingSetupFields(details: SellingSetupDetails): SellingSetupField[] {
  const missing: SellingSetupField[] = [];
  if (!details.location_name) missing.push('location');
  if (!details.food_name) missing.push('food');
  if (details.quantity === null || details.quantity <= 0 || !details.unit) missing.push('quantity');
  if (details.selling_price === null) missing.push('selling_price');
  if (details.estimated_cost === null) missing.push('cost');
  return missing;
}

export { EMPTY_DETAILS };
