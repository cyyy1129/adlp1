-- Additive migration for reliable completed-session check-ins.
--
-- The deployed project predates this table.  Creating it before applying the
-- later integrity/index statements keeps the migration safe for that schema
-- while retaining the add-column behaviour for any environment that already
-- has an older version of the table.

alter table public.selling_plans
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.daily_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  selling_plan_id uuid not null references public.selling_plans(id) on delete cascade,
  checkin_date date not null,
  location_name text,
  prepared_quantity numeric not null check (prepared_quantity > 0),
  leftover_quantity numeric not null check (leftover_quantity >= 0 and leftover_quantity <= prepared_quantity),
  estimated_sold_quantity numeric not null check (estimated_sold_quantity >= 0),
  unit text not null,
  crowd_level text not null check (crowd_level in ('Quiet', 'Normal', 'Packed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.daily_checkins
  add column if not exists estimated_sold_quantity numeric,
  add column if not exists updated_at timestamptz not null default now();

-- Preserve an older table's records before enforcing the calculated value.
update public.daily_checkins
set estimated_sold_quantity = greatest(0, prepared_quantity - leftover_quantity)
where estimated_sold_quantity is null;

create unique index if not exists daily_checkins_user_plan_unique
  on public.daily_checkins (user_id, selling_plan_id);

alter table public.daily_checkins enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'daily_checkins'
      and policyname = 'Users can manage their own daily check-ins'
  ) then
    create policy "Users can manage their own daily check-ins"
      on public.daily_checkins
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end
$$;
