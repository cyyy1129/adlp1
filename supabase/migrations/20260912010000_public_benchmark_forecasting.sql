-- Public-data forecasting layer.
--
-- These tables intentionally do not reuse external_signals: that table is an
-- audit trail for data attached to one selling plan, whereas the tables below
-- retain source-level public data, provenance, and model methodology.

create table if not exists public.data_sources (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  name text not null,
  publisher text not null,
  source_url text not null,
  license text,
  coverage_start date,
  coverage_end date,
  source_type text not null check (source_type in ('public_benchmark', 'contextual_feature', 'price_reference')),
  validation_status text not null default 'pending_review' check (validation_status in ('validated', 'pending_review', 'rejected')),
  retrieved_at timestamptz,
  notes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.public_bazaar_benchmarks (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.data_sources(id) on delete restrict,
  year integer not null check (year between 2000 and 2100),
  bazaar_type text not null,
  state text,
  district text,
  location_name text,
  place_key text not null,
  stall_count numeric not null check (stall_count > 0),
  sales_value numeric not null check (sales_value >= 0),
  persons_engaged numeric check (persons_engaged >= 0),
  sales_value_per_stall numeric not null check (sales_value_per_stall >= 0),
  persons_engaged_per_stall numeric check (persons_engaged_per_stall >= 0),
  metric_definition text not null,
  is_item_level_target boolean not null default false check (is_item_level_target = false),
  created_at timestamptz not null default now(),
  unique (source_id, year, bazaar_type, place_key)
);

create table if not exists public.public_item_prices (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.data_sources(id) on delete restrict,
  year integer not null check (year between 2000 and 2100),
  state text,
  place_key text not null default 'malaysia',
  normalized_food_name text not null,
  display_name text not null,
  unit text not null,
  average_price numeric not null check (average_price >= 0),
  location_scope text not null,
  is_demand_target boolean not null default false check (is_demand_target = false),
  created_at timestamptz not null default now(),
  unique (source_id, year, place_key, normalized_food_name, unit)
);

create table if not exists public.public_context_observations (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.data_sources(id) on delete restrict,
  observation_date date not null,
  canonical_location_key text,
  latitude double precision,
  longitude double precision,
  signal_type text not null,
  numeric_value numeric,
  unit text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (source_id, observation_date, canonical_location_key, signal_type)
);

-- A transit observation is usable only when this table contains a reviewed,
-- explicit location-to-station link. No proximity heuristic is stored here.
create table if not exists public.public_location_station_links (
  id uuid primary key default gen_random_uuid(),
  canonical_location_key text not null unique,
  location_name text not null,
  station_name text not null,
  source_id uuid references public.data_sources(id) on delete restrict,
  validation_status text not null default 'pending_review' check (validation_status in ('validated', 'pending_review', 'rejected')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.model_versions (
  id uuid primary key default gen_random_uuid(),
  model_name text not null,
  version text not null,
  methodology text not null,
  training_period_start date,
  training_period_end date,
  feature_definition jsonb not null default '{}'::jsonb,
  evaluation_metrics jsonb not null default '{}'::jsonb,
  source_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (model_name, version)
);

-- Immutable-enough per-plan evidence snapshot. This avoids treating public
-- source rows as plan-specific external signals while preserving exactly what
-- a seller saw when a recommendation was created.
create table if not exists public.forecast_evidence_snapshots (
  id uuid primary key default gen_random_uuid(),
  selling_plan_id uuid not null references public.selling_plans(id) on delete cascade,
  model_version_id uuid references public.model_versions(id) on delete set null,
  source_type text not null check (source_type in ('public_benchmark', 'personalized', 'insufficient_evidence')),
  evidence jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists public_bazaar_benchmarks_lookup_idx
  on public.public_bazaar_benchmarks (year desc, bazaar_type, place_key);
create index if not exists public_item_prices_lookup_idx
  on public.public_item_prices (year desc, normalized_food_name, place_key);
create index if not exists public_context_observations_lookup_idx
  on public.public_context_observations (observation_date, canonical_location_key, signal_type);
create index if not exists forecast_evidence_snapshots_plan_idx
  on public.forecast_evidence_snapshots (selling_plan_id, created_at desc);

alter table public.data_sources enable row level security;
alter table public.public_bazaar_benchmarks enable row level security;
alter table public.public_item_prices enable row level security;
alter table public.public_context_observations enable row level security;
alter table public.public_location_station_links enable row level security;
alter table public.model_versions enable row level security;
alter table public.forecast_evidence_snapshots enable row level security;

drop policy if exists "Authenticated users can read public forecasting sources" on public.data_sources;
create policy "Authenticated users can read public forecasting sources"
  on public.data_sources for select to authenticated using (validation_status = 'validated');

drop policy if exists "Authenticated users can read public bazaar benchmarks" on public.public_bazaar_benchmarks;
create policy "Authenticated users can read public bazaar benchmarks"
  on public.public_bazaar_benchmarks for select to authenticated using (true);

drop policy if exists "Authenticated users can read public item prices" on public.public_item_prices;
create policy "Authenticated users can read public item prices"
  on public.public_item_prices for select to authenticated using (true);

drop policy if exists "Authenticated users can read public context observations" on public.public_context_observations;
create policy "Authenticated users can read public context observations"
  on public.public_context_observations for select to authenticated using (true);

drop policy if exists "Authenticated users can read validated location station links" on public.public_location_station_links;
create policy "Authenticated users can read validated location station links"
  on public.public_location_station_links for select to authenticated using (validation_status = 'validated');

drop policy if exists "Authenticated users can read forecast model versions" on public.model_versions;
create policy "Authenticated users can read forecast model versions"
  on public.model_versions for select to authenticated using (true);

drop policy if exists "Users can read their own forecast evidence" on public.forecast_evidence_snapshots;
create policy "Users can read their own forecast evidence"
  on public.forecast_evidence_snapshots for select to authenticated
  using (exists (
    select 1 from public.selling_plans plan
    where plan.id = selling_plan_id and plan.user_id = auth.uid()
  ));

drop policy if exists "Users can insert their own forecast evidence" on public.forecast_evidence_snapshots;
create policy "Users can insert their own forecast evidence"
  on public.forecast_evidence_snapshots for insert to authenticated
  with check (exists (
    select 1 from public.selling_plans plan
    where plan.id = selling_plan_id and plan.user_id = auth.uid()
  ));
