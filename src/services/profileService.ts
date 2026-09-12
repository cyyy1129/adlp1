// ============================================================
// Profile Service — Supabase profile CRUD
// ============================================================

import {
  supabase,
  isSupabaseConfigured,
} from '../lib/supabase';

import type { Profile } from '../types/database';
import { saveOnboardingSellerDetails } from './sellingSetupService';

const NOT_CONFIGURED =
  'Supabase is not configured.';

export async function getProfile(
  userId: string
): Promise<{
  data: Profile | null;
  error: string | null;
}> {
  if (!isSupabaseConfigured) {
    return {
      data: null,
      error: NOT_CONFIGURED,
    };
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    return {
      data: null,
      error: error.message,
    };
  }

  return {
    data: data as Profile,
    error: null,
  };
}

export async function updateProfile(
  userId: string,
  updates: Partial<
    Omit<
      Profile,
      'id' | 'created_at' | 'updated_at'
    >
  >
): Promise<{
  error: string | null;
}> {
  if (!isSupabaseConfigured) {
    return {
      error: NOT_CONFIGURED,
    };
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    return {
      error: error.message,
    };
  }

  return {
    error: null,
  };
}

export async function completeOnboarding(
  userId: string,
  data: {
    food_categories: string[];
    custom_food_name: string | null;
    state: string | null;
    city: string | null;
    default_location_name: string | null;
    default_latitude: number | null;
    default_longitude: number | null;
    onboarding_usual_quantity: number;
    onboarding_unit: string;
    onboarding_selling_price: number;
    onboarding_estimated_cost: number;
    food_name: string;
    food_category: string;
    preferred_language: 'en' | 'ms';
  }
): Promise<{
  error: string | null;
}> {
  if (!isSupabaseConfigured) {
    return {
      error: NOT_CONFIGURED,
    };
  }

  // The profile stores the quiz choices; the reusable item/defaults belong to
  // seller_food. Do this before marking onboarding complete so a retry can
  // never leave an apparently completed profile without its main food item.
  const sellerDetailsResult = await saveOnboardingSellerDetails(userId, {
    food_name: data.food_name,
    food_category: data.food_category,
    quantity: data.onboarding_usual_quantity,
    unit: data.onboarding_unit,
    selling_price: data.onboarding_selling_price,
    estimated_cost: data.onboarding_estimated_cost,
  });
  if (sellerDetailsResult.error) return { error: sellerDetailsResult.error };

  const { data: updatedProfile, error } = await supabase
    .from('profiles')
    .update({
      food_categories: data.food_categories,
      custom_food_name: data.custom_food_name,

      // Filled from the selected map/search result when available.
      state: data.state,
      city: data.city,
      default_location_name: data.default_location_name,
      default_latitude: data.default_latitude,
      default_longitude: data.default_longitude,
      default_location_updated_at: data.default_location_name ? new Date().toISOString() : null,
      onboarding_usual_quantity: data.onboarding_usual_quantity,
      onboarding_unit: data.onboarding_unit,
      onboarding_selling_price: data.onboarding_selling_price,
      onboarding_estimated_cost: data.onboarding_estimated_cost,

      preferred_language:
        data.preferred_language,

      onboarding_completed: true,

      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select('id')
    .maybeSingle();

  if (error || !updatedProfile) {
    return {
      error: error?.message ?? 'Your profile could not be updated. Please sign in again and try once more.',
    };
  }

  return {
    error: null,
  };
}
