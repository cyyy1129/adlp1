// ============================================================
// Auth Service — wraps Supabase Auth operations
// ============================================================

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { RegisterData, LoginData } from '../types/auth';

const NOT_CONFIGURED = 'Supabase is not configured. Please set environment variables.';

export async function signUp(data: RegisterData) {
  if (!isSupabaseConfigured) {
    return { user: null, error: NOT_CONFIGURED };
  }

  const { data: authData, error } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      data: {
        first_name: data.firstName,
        last_name: data.lastName,
        username: data.username,
        phone: data.phone,
      },
    },
  });

  if (error) {
    return { user: null, error: error.message };
  }

  // If email confirmation is enabled, user won't have a session yet
  const needsVerification =
    authData.user && !authData.session;

  return { user: authData.user, error: null, needsVerification };
}

export async function signIn(data: LoginData) {
  if (!isSupabaseConfigured) {
    return { session: null, error: NOT_CONFIGURED };
  }

  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email: data.email,
    password: data.password,
  });

  if (error) {
    return { session: null, error: error.message };
  }

  return { session: authData.session, error: null };
}

export async function signOut() {
  if (!isSupabaseConfigured) return;
  await supabase.auth.signOut();
}

export async function resetPassword(email: string) {
  if (!isSupabaseConfigured) {
    return { error: NOT_CONFIGURED };
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email);
  return { error: error?.message ?? null };
}

export async function getSession() {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthStateChange(callback: (session: unknown) => void) {
  if (!isSupabaseConfigured) return { data: { subscription: { unsubscribe: () => {} } } };
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
}
