// ============================================================
// Auth Types
// ============================================================

import type { Session, User } from '@supabase/supabase-js';
import type { Profile } from './database';

export interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
}

export interface RegisterData {
  firstName: string;
  lastName: string;
  username: string;
  phone: string;
  email: string;
  password: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  supabaseConfigured: boolean;
  login: (data: LoginData) => Promise<{ error: string | null }>;
  register: (data: RegisterData) => Promise<{ error: string | null; needsVerification?: boolean }>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
}
