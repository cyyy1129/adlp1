// ============================================================
// Database Types — aligned with Supabase PostgreSQL schema
// ============================================================

export interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  username: string;
  phone: string;
  // Auth owns email in the deployed schema. Some older profile rows do not
  // expose a copied email column, so the UI falls back to auth.user.email.
  email?: string | null;

  state: string | null;
  city: string | null;
  default_location_name: string | null;
  default_latitude: number | null;
  default_longitude: number | null;
  default_location_updated_at: string | null;
  daily_location_confirmed_on: string | null;
  voice_setup_completed_at: string | null;
  default_seller_food_id: string | null;
  onboarding_usual_quantity: number | null;
  onboarding_unit: string | null;
  onboarding_selling_price: number | null;
  onboarding_estimated_cost: number | null;

  preferred_language: 'en' | 'ms';
  onboarding_completed: boolean;

  food_categories: string[];
  custom_food_name: string | null;

  created_at: string;
  updated_at?: string;
}

export interface SellerFood {
  id: string;
  user_id: string;
  food_category: string;
  food_name: string;
  unit: string;
  avg_price: number;
  default_quantity: number | null;
  estimated_cost: number | null;
  created_at: string;
  updated_at?: string;
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
  updated_at?: string;
}

export interface Recommendation {
  id: string;
  selling_plan_id: string;
  food_id: string | null;
  recommended_qty: number | null;
  min_qty: number | null;
  max_qty: number | null;
  confidence: number | null;
  reasoning: string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExternalSignal {
  id: string;
  // Nullable only for legacy rows retained from external_signals.plan_id.
  // New writes always populate selling_plan_id via the migration trigger.
  selling_plan_id: string | null;
  signal_type: string | null;
  signal_data: Record<string, unknown> | null;
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
  estimated_sold_quantity: number;
  unit: string;
  crowd_level: CrowdLevel;
  created_at: string;
  updated_at: string;
}

// Public, validated datasets are deliberately separate from seller-owned
// plans/check-ins and the per-plan external_signals audit trail.
export interface DataSource {
  id: string;
  source_key: string;
  name: string;
  publisher: string;
  source_url: string;
  license: string | null;
  coverage_start: string | null;
  coverage_end: string | null;
  source_type: 'public_benchmark' | 'contextual_feature' | 'price_reference';
  validation_status: 'validated' | 'pending_review' | 'rejected';
  retrieved_at: string | null;
  notes: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface PublicBazaarBenchmark {
  id: string;
  source_id: string;
  year: number;
  bazaar_type: string;
  state: string | null;
  district: string | null;
  location_name: string | null;
  place_key: string;
  stall_count: number;
  sales_value: number;
  persons_engaged: number | null;
  sales_value_per_stall: number;
  persons_engaged_per_stall: number | null;
  metric_definition: string;
  is_item_level_target: false;
  created_at: string;
}

export interface PublicItemPrice {
  id: string;
  source_id: string;
  year: number;
  state: string | null;
  place_key: string;
  normalized_food_name: string;
  display_name: string;
  unit: string;
  average_price: number;
  location_scope: string;
  is_demand_target: false;
  created_at: string;
}
