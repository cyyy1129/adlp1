// ============================================================
// Completed-selling-session check-in service.
// A user/plan upsert makes retrying or refreshing safe.
// ============================================================

import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { DailyCheckin } from '../types/database';

export const CHECKIN_UNITS = ['bowls', 'pieces', 'packs', 'kg', 'litres', 'other'] as const;
export type CheckinUnit = typeof CHECKIN_UNITS[number] | string;

export interface DailyCheckinInput {
  user_id: string;
  selling_plan_id: string;
  checkin_date: string;
  location_name: string;
  prepared_quantity: number;
  leftover_quantity: number;
  unit: CheckinUnit;
  crowd_level: DailyCheckin['crowd_level'];
}

function validate(input: DailyCheckinInput): string | null {
  if (!input.location_name.trim()) return 'Please enter a selling location.';
  if (!Number.isFinite(input.prepared_quantity) || input.prepared_quantity <= 0) return 'Prepared quantity must be greater than zero.';
  if (!Number.isFinite(input.leftover_quantity) || input.leftover_quantity < 0) return 'Leftover quantity cannot be negative.';
  if (input.leftover_quantity > input.prepared_quantity) return 'Leftover quantity cannot be more than the prepared quantity.';
  if (!input.unit.trim()) return 'Please select or enter a unit.';
  return null;
}

export function getEstimatedSold(preparedQuantity: number, leftoverQuantity: number): number {
  return Math.max(0, preparedQuantity - leftoverQuantity);
}

export async function getDailyCheckin(userId: string, sellingPlanId: string): Promise<{ data: DailyCheckin | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: 'Supabase is not configured.' };

  const { data, error } = await supabase
    .from('daily_checkins')
    .select('*')
    .eq('user_id', userId)
    .eq('selling_plan_id', sellingPlanId)
    .maybeSingle();
  return { data: data as DailyCheckin | null, error: error?.message ?? null };
}

export async function saveDailyCheckin(input: DailyCheckinInput): Promise<{ data: DailyCheckin | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: 'Supabase is not configured.' };
  const validationError = validate(input);
  if (validationError) return { data: null, error: validationError };

  const { data: plan, error: planLookupError } = await supabase
    .from('selling_plans')
    .select('id, status')
    .eq('id', input.selling_plan_id)
    .eq('user_id', input.user_id)
    .maybeSingle();
  if (planLookupError || !plan) return { data: null, error: planLookupError?.message ?? 'Selling plan not found.' };
  if (plan.status !== 'confirmed' && plan.status !== 'completed') {
    return { data: null, error: 'Only a confirmed selling plan can have a selling result.' };
  }

  const estimatedSold = getEstimatedSold(input.prepared_quantity, input.leftover_quantity);
  const { data, error } = await supabase
    .from('daily_checkins')
    .upsert({
      ...input,
      location_name: input.location_name.trim(),
      unit: input.unit.trim(),
      estimated_sold_quantity: estimatedSold,
    }, { onConflict: 'user_id,selling_plan_id' })
    .select('*')
    .single();
  if (error || !data) return { data: null, error: error?.message ?? 'Could not save your selling result.' };

  const { error: planError } = await supabase
    .from('selling_plans')
    .update({ status: 'completed', updated_at: new Date().toISOString() })
    .eq('id', input.selling_plan_id)
    .eq('user_id', input.user_id);
  if (planError) {
    return { data: data as DailyCheckin, error: `Your result was saved, but the plan could not be marked complete: ${planError.message}` };
  }

  return { data: data as DailyCheckin, error: null };
}
