// ============================================================
// Database Types — aligned with Supabase PostgreSQL schema
// ============================================================

export interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  username: string;
  phone: string;
  email: string;

  state: string | null;
  city: string | null;

  preferred_language: 'en' | 'ms';
  onboarding_completed: boolean;

  food_categories: string[];
  custom_food_name: string | null;

  created_at: string;
  updated_at: string;
}

export interface SellerFood {
  id: string;
  user_id: string;
  food_category: string;
  food_name: string;
  unit: string;
  avg_price: number;
  created_at: string;
  updated_at: string;
}

export interface SellingPlan {
  id: string;
  user_id: string;
  plan_date: string;
  start_time: string | null;
  end_time: string | null;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  status:
  | 'draft'
  | 'confirmed'
  | 'completed'
  | 'cancelled';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SellingItem {
  id: string;
  plan_id: string;
  food_id: string;
  planned_qty: number;
  unit_price: number;
  created_at: string;
  updated_at: string;
}

export interface Recommendation {
  id: string;
  selling_plan_id: string;
  food_id: string;
  recommended_qty: number;
  min_qty: number;
  max_qty: number;
  confidence: number;
  reasoning: string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExternalSignal {
  id: string;
  selling_plan_id: string;
  signal_type: string;
  signal_data: Record<string, unknown>;
  source: string | null;
  created_at: string;
  updated_at: string;
}

export type CrowdLevel =
  | 'Quiet'
  | 'Normal'
  | 'Packed';

export interface DailyCheckin {
  id: string;
  user_id: string;
  selling_plan_id: string;
  checkin_date: string;
  location_name: string | null;
  prepared_quantity: number;
  leftover_quantity: number;
  unit: string;
  crowd_level: CrowdLevel;
  created_at: string;
  updated_at: string;
}