-- Reconcile the deployed pre-forecast schema with the application's
-- plan-scoped forecast audit trail.  All changes are additive: legacy
-- external_signals.plan_id values are preserved and mirrored into the new
-- selling_plan_id column rather than deleting or rewriting records.

create table if not exists public.recommendations (
  id uuid primary key default gen_random_uuid(),
  selling_plan_id uuid not null references public.selling_plans(id) on delete cascade,
  food_id uuid references public.seller_food(id) on delete set null,
  recommended_qty numeric check (recommended_qty >= 0),
  min_qty numeric check (min_qty >= 0),
  max_qty numeric check (max_qty >= 0),
  confidence numeric check (confidence >= 0 and confidence <= 100),
  reasoning text,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (min_qty is null or max_qty is null or min_qty <= max_qty)
);

-- The live table has a legacy plan_id column.  Keep it for compatibility
-- until a separately planned deprecation, but make selling_plan_id the
-- canonical application field.
create table if not exists public.external_signals (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid,
  selling_plan_id uuid references public.selling_plans(id) on delete cascade,
  signal_type text not null default 'legacy_signal',
  signal_data jsonb not null default '{}'::jsonb,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.external_signals
  add column if not exists plan_id uuid,
  add column if not exists selling_plan_id uuid,
  add column if not exists signal_type text default 'legacy_signal',
  add column if not exists signal_data jsonb default '{}'::jsonb,
  add column if not exists source text,
  add column if not exists updated_at timestamptz not null default now();

-- Populate the canonical field from existing records without removing the
-- old column or any legacy signal payload.
update public.external_signals
set selling_plan_id = plan_id
where selling_plan_id is null and plan_id is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'external_signals_selling_plan_id_fkey'
      and conrelid = 'public.external_signals'::regclass
  ) then
    alter table public.external_signals
      add constraint external_signals_selling_plan_id_fkey
      foreign key (selling_plan_id) references public.selling_plans(id) on delete cascade;
  end if;
end
$$;

-- Some live installations still require plan_id to be populated.  This
-- compatibility trigger permits new application writes that use only the
-- canonical selling_plan_id field, while keeping both identifiers consistent.
create or replace function public.sync_external_signal_plan_ids()
returns trigger
language plpgsql
as $$
begin
  if new.selling_plan_id is null then
    new.selling_plan_id := new.plan_id;
  end if;
  if new.plan_id is null then
    new.plan_id := new.selling_plan_id;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_external_signal_plan_ids on public.external_signals;
create trigger sync_external_signal_plan_ids
  before insert or update on public.external_signals
  for each row execute function public.sync_external_signal_plan_ids();

create or replace function public.set_demandlens_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_daily_checkins_updated_at on public.daily_checkins;
create trigger set_daily_checkins_updated_at
  before update on public.daily_checkins
  for each row execute function public.set_demandlens_updated_at();

drop trigger if exists set_recommendations_updated_at on public.recommendations;
create trigger set_recommendations_updated_at
  before update on public.recommendations
  for each row execute function public.set_demandlens_updated_at();

drop trigger if exists set_external_signals_updated_at on public.external_signals;
create trigger set_external_signals_updated_at
  before update on public.external_signals
  for each row execute function public.set_demandlens_updated_at();

drop trigger if exists set_selling_plans_updated_at on public.selling_plans;
create trigger set_selling_plans_updated_at
  before update on public.selling_plans
  for each row execute function public.set_demandlens_updated_at();

create index if not exists recommendations_plan_created_idx
  on public.recommendations (selling_plan_id, created_at desc);
create index if not exists external_signals_selling_plan_created_idx
  on public.external_signals (selling_plan_id, created_at desc);
create index if not exists external_signals_forecast_summary_idx
  on public.external_signals (selling_plan_id, source, created_at desc)
  where signal_type = 'forecast_summary';

alter table public.recommendations enable row level security;
alter table public.external_signals enable row level security;

drop policy if exists "Users can manage their own recommendations" on public.recommendations;
create policy "Users can manage their own recommendations"
  on public.recommendations
  for all
  using (exists (
    select 1 from public.selling_plans plan
    where plan.id = selling_plan_id and plan.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.selling_plans plan
    where plan.id = selling_plan_id and plan.user_id = auth.uid()
  ));

drop policy if exists "Users can manage their own external signals" on public.external_signals;
create policy "Users can manage their own external signals"
  on public.external_signals
  for all
  using (exists (
    select 1 from public.selling_plans plan
    where plan.id = coalesce(selling_plan_id, plan_id) and plan.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.selling_plans plan
    where plan.id = coalesce(selling_plan_id, plan_id) and plan.user_id = auth.uid()
  ));

-- Tell PostgREST to expose the additive columns immediately after the
-- migration.  This addresses stale schema-cache errors without a restart.
notify pgrst, 'reload schema';
