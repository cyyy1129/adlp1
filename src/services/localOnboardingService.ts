// Local onboarding preferences for the no-sign-in product flow.
// These values personalise only this browser and are never submitted to
// Supabase without an authenticated seller session.

import type { Profile } from '../types/database';

const STORAGE_KEY = 'demandlens_local_onboarding';

export interface LocalOnboardingInput {
  food_categories: string[];
  custom_food_name: string | null;
  state: string | null;
  city: string | null;
  default_location_name?: string | null;
  default_latitude?: number | null;
  default_longitude?: number | null;
  preferred_language: 'en' | 'ms';
}

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function isValidLocalOnboarding(value: unknown): value is LocalOnboardingInput {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<LocalOnboardingInput>;
  return Array.isArray(candidate.food_categories)
    && (candidate.custom_food_name === null || typeof candidate.custom_food_name === 'string')
    && (candidate.state === null || typeof candidate.state === 'string')
    && (candidate.city === null || typeof candidate.city === 'string')
    && (candidate.preferred_language === 'en' || candidate.preferred_language === 'ms');
}

function toLocalProfile(input: LocalOnboardingInput): Profile {
  return {
    id: 'local-onboarding',
    first_name: '',
    last_name: '',
    username: '',
    phone: '',
    email: null,
    food_categories: input.food_categories,
    custom_food_name: input.custom_food_name,
    state: input.state,
    city: input.city,
    default_location_name: input.default_location_name ?? null,
    default_latitude: input.default_latitude ?? null,
    default_longitude: input.default_longitude ?? null,
    default_location_updated_at: null,
    daily_location_confirmed_on: null,
    voice_setup_completed_at: null,
    default_seller_food_id: null,
    onboarding_usual_quantity: null,
    onboarding_unit: null,
    onboarding_selling_price: null,
    onboarding_estimated_cost: null,
    preferred_language: input.preferred_language,
    onboarding_completed: true,
    created_at: '',
    updated_at: '',
  };
}

export function getLocalOnboardingProfile(): Profile | null {
  if (!canUseStorage()) return null;

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const parsed: unknown = JSON.parse(stored);
    return isValidLocalOnboarding(parsed) ? toLocalProfile(parsed) : null;
  } catch {
    return null;
  }
}

export function saveLocalOnboarding(input: LocalOnboardingInput): Profile {
  const cleaned: LocalOnboardingInput = {
    food_categories: [...new Set(input.food_categories)],
    custom_food_name: input.custom_food_name?.trim() || null,
    state: input.state?.trim() || null,
    city: input.city?.trim() || null,
    default_location_name: input.default_location_name?.trim() || null,
    default_latitude: input.default_latitude ?? null,
    default_longitude: input.default_longitude ?? null,
    preferred_language: input.preferred_language,
  };

  if (canUseStorage()) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
  }

  return toLocalProfile(cleaned);
}
