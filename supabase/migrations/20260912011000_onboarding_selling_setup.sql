-- Minimal persistence for the one-time seller setup.
-- A profile owns the reusable selling location, while seller_food owns the
-- reusable item, quantity, selling-price, and cost defaults. This avoids
-- creating a fake selling session just to store setup information.

alter table public.profiles
  add column if not exists default_location_name text,
  add column if not exists default_latitude double precision,
  add column if not exists default_longitude double precision,
  add column if not exists default_location_updated_at timestamptz,
  add column if not exists daily_location_confirmed_on date,
  add column if not exists voice_setup_completed_at timestamptz,
  add column if not exists default_seller_food_id uuid references public.seller_food(id) on delete set null,
  add column if not exists onboarding_usual_quantity numeric check (onboarding_usual_quantity is null or onboarding_usual_quantity >= 0),
  add column if not exists onboarding_unit text,
  add column if not exists onboarding_selling_price numeric check (onboarding_selling_price is null or onboarding_selling_price >= 0),
  add column if not exists onboarding_estimated_cost numeric check (onboarding_estimated_cost is null or onboarding_estimated_cost >= 0);

alter table public.seller_food
  add column if not exists default_quantity numeric check (default_quantity is null or default_quantity >= 0),
  add column if not exists estimated_cost numeric check (estimated_cost is null or estimated_cost >= 0);

create index if not exists profiles_default_seller_food_idx
  on public.profiles (default_seller_food_id);

notify pgrst, 'reload schema';
