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

function recordCheckinDiagnostic(action: string, error: unknown): void {
  console.error(`[DemandLens check-in] ${action}`, error);
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
  if (error) {
    recordCheckinDiagnostic('Existing check-in lookup failed.', error);
    return { data: null, error: 'Your saved selling result could not be loaded right now.' };
  }
  return { data: data as DailyCheckin | null, error: null };
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
  if (planLookupError || !plan) {
    if (planLookupError) recordCheckinDiagnostic('Selling-plan lookup failed.', planLookupError);
    return { data: null, error: 'Selling plan not found.' };
  }
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
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,selling_plan_id' })
    .select('*')
    .single();
  if (error || !data) {
    if (error) recordCheckinDiagnostic('Selling-result persistence failed.', error);
    return { data: null, error: 'Your selling result could not be saved. Please try again.' };
  }

  const { error: planError } = await supabase
    .from('selling_plans')
    .update({ status: 'completed', updated_at: new Date().toISOString() })
    .eq('id', input.selling_plan_id)
    .eq('user_id', input.user_id);
  if (planError) {
    recordCheckinDiagnostic('Plan completion update failed after check-in saved.', planError);
    return { data: data as DailyCheckin, error: 'Your result was saved, but the plan status could not be updated yet. Please try again.' };
  }

  return { data: data as DailyCheckin, error: null };
}
