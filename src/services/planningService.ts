// ============================================================
// Selling-plan persistence using the existing Supabase tables.
// ============================================================

import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { SellerFood, SellingPlan } from '../types/database';
import type { FoodSelection, PlanningDraft, SavedPlanResult } from '../types/planning';

const NOT_CONFIGURED = 'Supabase is not configured, so this selling plan cannot be saved yet.';

export async function getSellerFoods(userId: string): Promise<{ data: SellerFood[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: null };

  const { data, error } = await supabase
    .from('seller_food')
    .select('*')
    .eq('user_id', userId)
    .order('food_name');

  return { data: (data as SellerFood[] | null) ?? [], error: error?.message ?? null };
}

async function findOrCreateSellerFood(userId: string, selection: FoodSelection): Promise<{ data: SellerFood | null; error: string | null }> {
  if (selection.seller_food_id) {
    const { data, error } = await supabase
      .from('seller_food')
      .select('*')
      .eq('id', selection.seller_food_id)
      .eq('user_id', userId)
      .maybeSingle();
    return { data: data as SellerFood | null, error: error?.message ?? null };
  }

  const { data: existing, error: lookupError } = await supabase
    .from('seller_food')
    .select('*')
    .eq('user_id', userId)
    .eq('food_name', selection.food_name)
    .eq('food_category', selection.food_category)
    .maybeSingle();

  if (lookupError) return { data: null, error: lookupError.message };
  if (existing) return { data: existing as SellerFood, error: null };

  // The current schema requires a unit and price. Zero explicitly means
  // "not planned yet"; this feature never invents a selling price or quantity.
  const { data, error } = await supabase
    .from('seller_food')
    .insert({
      user_id: userId,
      food_category: selection.food_category,
      food_name: selection.food_name,
      unit: 'serving',
      avg_price: 0,
    })
    .select('*')
    .single();

  return { data: data as SellerFood | null, error: error?.message ?? null };
}

export async function saveSellingPlan(userId: string, draft: PlanningDraft): Promise<{ data: SavedPlanResult | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: NOT_CONFIGURED };
  if (!draft.schedule || !draft.location || !draft.food) {
    return { data: null, error: 'Please confirm the date, location, and food before saving.' };
  }

  const { data: sellerFood, error: foodError } = await findOrCreateSellerFood(userId, draft.food);
  if (foodError || !sellerFood) return { data: null, error: foodError ?? 'Could not prepare the selling item.' };

  const { data: plan, error: planError } = await supabase
    .from('selling_plans')
    .insert({
      user_id: userId,
      plan_date: draft.schedule.date,
      start_time: draft.schedule.start_time,
      end_time: draft.schedule.end_time,
      location_name: draft.location.location_name,
      latitude: draft.location.latitude,
      longitude: draft.location.longitude,
      status: 'confirmed',
      notes: null,
    })
    .select('*')
    .single();

  if (planError || !plan) return { data: null, error: planError?.message ?? 'Could not save the selling plan.' };
  const savedPlan = plan as SellingPlan;

  const { error: itemError } = await supabase
    .from('selling_items')
    .insert({
      plan_id: savedPlan.id,
      food_id: sellerFood.id,
      planned_qty: 0,
      unit_price: 0,
    });

  if (itemError) {
    // Avoid leaving a plan that cannot be used because its required item failed.
    await supabase.from('selling_plans').delete().eq('id', savedPlan.id).eq('user_id', userId);
    return { data: null, error: itemError.message };
  }

  return { data: { planId: savedPlan.id }, error: null };
}
