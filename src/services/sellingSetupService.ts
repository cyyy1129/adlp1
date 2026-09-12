// ============================================================
// One-time seller setup persistence.
//
// This deliberately stores reusable defaults on the existing Profile and
// SellerFood records. It does not create a selling_plan until the seller
// actually starts a dated selling session in the existing planning flow.
// ============================================================

import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { Profile, SellerFood } from '../types/database';

export interface SellerSetup {
  seller_food_id: string | null;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  food_name: string | null;
  food_category: string | null;
  quantity: number | null;
  unit: string | null;
  selling_price: number | null;
  estimated_cost: number | null;
}

export interface SellerSetupInput {
  location_name: string;
  latitude: number | null;
  longitude: number | null;
  food_name: string;
  food_category: string;
  quantity: number;
  unit: string;
  selling_price: number;
  estimated_cost: number;
}

/**
 * The onboarding quiz collects these reusable defaults before the seller
 * gives their first voice answer. Keeping them on the existing seller_food
 * row avoids a second profile shape or a synthetic selling plan.
 */
export interface OnboardingSellerDetailsInput {
  food_name: string;
  food_category: string;
  quantity: number;
  unit: string;
  selling_price: number;
  estimated_cost: number;
}

const NOT_CONFIGURED = 'Supabase is not configured.';

function isNumber(value: number | null): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function clean(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

async function upsertSellerFood(userId: string, input: OnboardingSellerDetailsInput): Promise<{ data: SellerFood | null; error: string | null }> {
  const foodName = clean(input.food_name);
  const unit = clean(input.unit);
  if (!foodName || !unit) return { data: null, error: 'Please provide a food item and unit.' };
  if (!isNumber(input.quantity) || input.quantity <= 0) return { data: null, error: 'Quantity must be greater than zero.' };
  if (!isNumber(input.selling_price) || input.selling_price < 0 || !isNumber(input.estimated_cost) || input.estimated_cost < 0) {
    return { data: null, error: 'Selling price and cost must be valid amounts.' };
  }

  const { data: existingFood, error: existingFoodError } = await supabase
    .from('seller_food')
    .select('*')
    .eq('user_id', userId)
    .eq('food_name', foodName)
    .maybeSingle();
  if (existingFoodError) return { data: null, error: existingFoodError.message };

  const foodPayload = {
    food_category: clean(input.food_category) || 'Others',
    food_name: foodName,
    unit,
    avg_price: input.selling_price,
    default_quantity: input.quantity,
    estimated_cost: input.estimated_cost,
    updated_at: new Date().toISOString(),
  };
  const foodResult = existingFood
    ? await supabase.from('seller_food').update(foodPayload).eq('id', (existingFood as SellerFood).id).eq('user_id', userId).select('*').single()
    : await supabase.from('seller_food').insert({ user_id: userId, ...foodPayload }).select('*').single();
  if (foodResult.error || !foodResult.data) return { data: null, error: foodResult.error?.message ?? 'Could not save your food details.' };
  return { data: foodResult.data as SellerFood, error: null };
}

export function inferFoodCategory(foodName: string, onboardingCategories: string[] = []): string {
  const value = foodName.toLocaleLowerCase();
  if (/\b(nasi|rice)\b/.test(value)) return 'Rice dishes';
  if (/\b(laksa|mee|mi |bihun|kuey teow|noodle|ramen|soto)\b/.test(value)) return 'Noodles';
  if (/\b(kuih|cake|dessert|puding|pudding|ais krim)\b/.test(value)) return 'Desserts';
  if (/\b(satay|ayam bakar|grill|ikan bakar|bbq)\b/.test(value)) return 'Grilled food';
  if (/\b(roti|bread|pastry|bun|bakery)\b/.test(value)) return 'Bakery';
  if (/\b(popiah|karipap|snack|goreng|keropok)\b/.test(value)) return 'Snacks';
  return onboardingCategories.find(category => category !== 'Others') ?? 'Others';
}

export async function getSellerSetup(userId: string): Promise<{ data: SellerSetup | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: NOT_CONFIGURED };

  const profileResult = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (profileResult.error) return { data: null, error: profileResult.error.message };

  const profile = profileResult.data as Profile | null;
  if (!profile) return { data: null, error: null };

  let food: SellerFood | null = null;
  if (profile.default_seller_food_id) {
    const foodResult = await supabase
      .from('seller_food')
      .select('*')
      .eq('id', profile.default_seller_food_id)
      .eq('user_id', userId)
      .maybeSingle();
    if (foodResult.error) return { data: null, error: foodResult.error.message };
    food = foodResult.data as SellerFood | null;
  }

  return {
    data: {
      seller_food_id: food?.id ?? null,
      location_name: profile.default_location_name ?? null,
      latitude: profile.default_latitude ?? null,
      longitude: profile.default_longitude ?? null,
      food_name: food?.food_name ?? null,
      food_category: food?.food_category ?? null,
      quantity: food?.default_quantity ?? null,
      unit: food?.unit ?? null,
      selling_price: food?.avg_price ?? null,
      estimated_cost: food?.estimated_cost ?? null,
    },
    error: null,
  };
}

/**
 * Persist the item/defaults collected in onboarding without marking the
 * one-shot voice setup as complete. That distinction lets the first focused
 * voice page remain a meaningful, one-time current-selling conversation.
 */
export async function saveOnboardingSellerDetails(userId: string, input: OnboardingSellerDetailsInput): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) return { error: NOT_CONFIGURED };
  const foodResult = await upsertSellerFood(userId, input);
  if (foodResult.error || !foodResult.data) return { error: foodResult.error ?? 'Could not save your food details.' };

  const { data, error } = await supabase
    .from('profiles')
    .update({ default_seller_food_id: foodResult.data.id, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select('id')
    .maybeSingle();
  return { error: error?.message ?? (data ? null : 'Your food details could not be linked to your profile.') };
}

export async function saveSellerSetup(userId: string, input: SellerSetupInput): Promise<{ data: SellerSetup | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: NOT_CONFIGURED };
  const locationName = clean(input.location_name);
  if (!locationName) return { data: null, error: 'Please provide a selling location.' };
  const foodResult = await upsertSellerFood(userId, input);
  if (foodResult.error || !foodResult.data) return { data: null, error: foodResult.error ?? 'Could not save your food details.' };
  const food = foodResult.data;

  const { data: updatedProfile, error: profileError } = await supabase
    .from('profiles')
    .update({
      default_location_name: locationName,
      default_latitude: input.latitude,
      default_longitude: input.longitude,
      default_location_updated_at: new Date().toISOString(),
      // The user has just explicitly supplied this location, so it is also
      // confirmed for today. The dashboard will ask again on a later date.
      daily_location_confirmed_on: malaysiaToday(),
      voice_setup_completed_at: new Date().toISOString(),
      default_seller_food_id: food.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select('id')
    .maybeSingle();
  if (profileError || !updatedProfile) return { data: null, error: profileError?.message ?? 'Your seller setup could not be saved. Please sign in again and try once more.' };

  return {
    data: {
      seller_food_id: food.id,
      location_name: locationName,
      latitude: input.latitude,
      longitude: input.longitude,
      food_name: food.food_name,
      food_category: food.food_category,
      quantity: food.default_quantity,
      unit: food.unit,
      selling_price: food.avg_price,
      estimated_cost: food.estimated_cost,
    },
    error: null,
  };
}

export function malaysiaToday(): string {
  // `Intl` date formatting is locale-dependent. Build the ISO date from its
  // parts so this always matches Supabase's `date` representation.
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export async function confirmDefaultLocationForToday(userId: string): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) return { error: NOT_CONFIGURED };
  const { data, error } = await supabase
    .from('profiles')
    .update({ daily_location_confirmed_on: malaysiaToday(), updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select('id')
    .maybeSingle();
  return { error: error?.message ?? (data ? null : 'Today’s location confirmation could not be saved.') };
}

export function hasSetup(setup: SellerSetup | null): boolean {
  return Boolean(
    setup?.seller_food_id && setup.location_name && setup.food_name && setup.quantity !== null && setup.unit
    && setup.selling_price !== null && setup.estimated_cost !== null
  );
}
