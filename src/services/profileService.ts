// ============================================================
// Profile Service — Supabase profile CRUD
// ============================================================

import {
  supabase,
  isSupabaseConfigured,
} from '../lib/supabase';

import type { Profile } from '../types/database';

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

  const { error } = await supabase
    .from('profiles')
    .update({
      food_categories: data.food_categories,
      custom_food_name: data.custom_food_name,

      // Automatically extracted from Google Maps.
      state: data.state,
      city: data.city,

      preferred_language:
        data.preferred_language,

      onboarding_completed: true,

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