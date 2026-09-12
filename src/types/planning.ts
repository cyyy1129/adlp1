// ============================================================
// Planning types -- conversational selling-session workflow
// ============================================================

export type PlanningStep =
  | 'ASK_SCHEDULE'
  | 'CONFIRM_SCHEDULE'
  | 'ASK_LOCATION'
  | 'CONFIRM_LOCATION'
  | 'ASK_FOOD'
  | 'CONFIRM_FOOD'
  | 'PLAN_READY'
  | 'SAVING'
  | 'COMPLETE';

export type PlanningField = 'schedule' | 'location' | 'food';

export interface SellingSchedule {
  date: string;
  start_time: string;
  end_time: string;
}

export interface SellingLocation {
  location_name: string;
  latitude: number | null;
  longitude: number | null;
}

export interface FoodSelection {
  food_name: string;
  food_category: string;
  seller_food_id: string | null;
}

export interface PlanningDraft {
  schedule: SellingSchedule | null;
  location: SellingLocation | null;
  food: FoodSelection | null;
}

export interface FoodOption extends FoodSelection {
  source: 'onboarding' | 'saved-item';
}

export interface ExtractionRequest {
  field: PlanningField;
  input: string;
  referenceDate?: string;
}

export interface ExtractionResult<T> {
  data: T | null;
  missing: string[];
  error: string | null;
  source: 'remote' | 'mock';
  fallbackNotice: string | null;
}

export interface SavedPlanResult {
  planId: string;
}
