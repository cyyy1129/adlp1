-- Additive migration for reliable completed-session check-ins.
alter table public.daily_checkins
  add column if not exists estimated_sold_quantity numeric;

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
