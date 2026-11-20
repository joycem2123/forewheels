-- Fore Wheels: bookings online, members' passes and gifted washes, staff, progress updates, push tokens.
-- Members create and cancel their own bookings through the functions below (never by writing rows directly).
-- Staff changes (progress, messages, refunds, gifts) go through the `staff` Edge Function.

-- ------------------------------------------------------------------ staff
create table if not exists public.staff (
  user_id uuid primary key references auth.users on delete cascade,
  role text not null default 'detailer' check (role in ('admin', 'detailer')),
  display_name text,
  created_at timestamptz not null default now()
);
alter table public.staff enable row level security;

create or replace function public.is_staff() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from staff where user_id = auth.uid());
$$;
create or replace function public.is_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from staff where user_id = auth.uid() and role = 'admin');
$$;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_admin() to authenticated;

drop policy if exists "staff read" on public.staff;
create policy "staff read" on public.staff for select to authenticated using (user_id = auth.uid() or public.is_staff());

-- Staff can see members' profiles (names, cars) for their bookings.
drop policy if exists "profiles staff read" on public.profiles;
create policy "profiles staff read" on public.profiles for select to authenticated using (public.is_staff());

-- ------------------------------------------------------------------ memberships (pass, credits, gifts)
create table if not exists public.memberships (
  user_id uuid primary key references auth.users on delete cascade,
  plan text not null default 'payg' check (plan in ('payg', 'monthly', 'season')),
  plan_renews timestamptz,
  credits jsonb not null default '{}'::jsonb,  -- {"express": {"used": 1, "of": 4}, ...}
  gifts jsonb not null default '{}'::jsonb,    -- {"signature": 1}
  updated_at timestamptz not null default now()
);
alter table public.memberships enable row level security;
drop policy if exists "memberships read" on public.memberships;
create policy "memberships read" on public.memberships for select to authenticated using (user_id = auth.uid() or public.is_staff());

-- ------------------------------------------------------------------ bookings
create table if not exists public.bookings (
  id text primary key default ('b-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
  user_id uuid references auth.users on delete set null default auth.uid(),  -- kept for records if the account is deleted
  tier text not null check (tier in ('express', 'signature', 'pro')),
  size text not null check (size in ('car', 'suv')),
  tee_time timestamptz not null,
  stall text not null default '',
  keys text not null default 'proshop' check (keys in ('unlocked', 'proshop')),
  addons text[] not null default '{}',
  status text not null default 'booked' check (status in ('booked', 'in_progress', 'ready', 'completed', 'cancelled')),
  stage text,
  progress numeric(4,3),
  paid numeric(10,2) not null default 0,
  used_credit boolean not null default false,
  credit_source text check (credit_source in ('plan', 'gift')),
  payment_method text check (payment_method in ('club', 'apple', 'card')),
  payment_ref text,
  checked_in_at timestamptz,
  ready_at timestamptz,
  completed_at timestamptz,
  refund numeric(10,2) not null default 0,
  refund_reason text,
  cancelled_by text check (cancelled_by in ('member', 'staff')),
  member_name text,
  vehicle_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists bookings_user_idx on public.bookings (user_id, tee_time);
create index if not exists bookings_tee_idx on public.bookings (tee_time);
drop trigger if exists bookings_touch on public.bookings;
create trigger bookings_touch before update on public.bookings for each row execute function public.touch_updated_at();
alter table public.bookings enable row level security;
drop policy if exists "bookings read" on public.bookings;
create policy "bookings read" on public.bookings for select to authenticated using (user_id = auth.uid() or public.is_staff());

-- What happened to a booking, newest last. Shown to the member as a timeline.
create table if not exists public.booking_updates (
  id bigint generated always as identity primary key,
  booking_id text not null references public.bookings on delete cascade,
  user_id uuid references auth.users on delete set null,
  kind text not null check (kind in ('booked', 'checked_in', 'stage', 'ready', 'completed', 'cancelled', 'refund', 'gift', 'message')),
  message text not null,
  by_staff uuid references auth.users on delete set null,
  at timestamptz not null default now()
);
create index if not exists booking_updates_booking_idx on public.booking_updates (booking_id, at);
alter table public.booking_updates enable row level security;
drop policy if exists "updates read" on public.booking_updates;
create policy "updates read" on public.booking_updates for select to authenticated using (user_id = auth.uid() or public.is_staff());

-- Free washes gifted by staff (a record of who gave what, and why).
create table if not exists public.credit_grants (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete set null,
  tier text not null check (tier in ('express', 'signature', 'pro')),
  qty int not null default 1 check (qty between 1 and 10),
  reason text,
  booking_id text references public.bookings on delete set null,
  granted_by uuid references auth.users on delete set null,
  at timestamptz not null default now()
);
alter table public.credit_grants enable row level security;
drop policy if exists "grants read" on public.credit_grants;
create policy "grants read" on public.credit_grants for select to authenticated using (user_id = auth.uid() or public.is_staff());

-- Phones to notify (Expo push tokens).
create table if not exists public.push_tokens (
  user_id uuid not null references auth.users on delete cascade,
  token text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, token)
);
alter table public.push_tokens enable row level security;
drop policy if exists "push own" on public.push_tokens;
create policy "push own" on public.push_tokens for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Live updates to the app.
do $$ begin
  alter publication supabase_realtime add table public.bookings;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.booking_updates;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.memberships;
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------------ member functions
create or replace function public.require_member() returns uuid
language plpgsql stable set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'account_needed' using errcode = 'P0001', hint = 'Create a free account to book.';
  end if;
  return uid;
end $$;

-- Plan credits for each pass (same as the app's catalog).
create or replace function public.plan_credits(p text) returns jsonb
language sql immutable as $$
  select case p
    when 'monthly' then '{"express": {"used": 0, "of": 4}, "signature": {"used": 0, "of": 1}}'::jsonb
    when 'season' then '{"express": {"used": 0, "of": 20}, "signature": {"used": 0, "of": 5}, "pro": {"used": 0, "of": 1}}'::jsonb
    else '{}'::jsonb end;
$$;

-- My pass, credits and gifts (created the first time).
create or replace function public.my_membership() returns public.memberships
language plpgsql security definer volatile set search_path = public as $$
declare uid uuid := public.require_member(); m memberships;
begin
  insert into memberships (user_id, plan_renews) values (uid, date_trunc('month', now()) + interval '1 month')
  on conflict (user_id) do nothing;
  select * into m from memberships where user_id = uid;
  return m;
end $$;

-- Switch pass. (Payment is taken by the app's payment step; Stripe will move this to the server.)
create or replace function public.set_plan(p text) returns public.memberships
language plpgsql security definer volatile set search_path = public as $$
declare uid uuid := public.require_member(); m memberships;
begin
  if p not in ('payg', 'monthly', 'season') then raise exception 'unknown_plan' using errcode = 'P0001'; end if;
  perform public.my_membership();
  update memberships set plan = p, credits = public.plan_credits(p),
    plan_renews = case p
      when 'season' then make_timestamptz(extract(year from now())::int + case when now() > make_timestamptz(extract(year from now())::int, 10, 15, 23, 59, 0, 'America/Edmonton') then 1 else 0 end, 10, 15, 23, 59, 0, 'America/Edmonton')
      else date_trunc('month', now()) + interval '1 month' end,
    updated_at = now()
  where user_id = uid returning * into m;
  return m;
end $$;

-- Book a detail. A free wash uses a pass credit first, then a gifted wash; the server checks one is left.
create or replace function public.create_booking(b jsonb) returns public.bookings
language plpgsql security definer volatile set search_path = public as $$
declare
  uid uuid := public.require_member();
  m memberships;
  t text := b ->> 'tier';
  tee timestamptz := (b ->> 'tee_time')::timestamptz;
  src text := null;
  row bookings;
  who text;
  car text;
begin
  if tee is null or tee < now() then raise exception 'tee_time_passed' using errcode = 'P0001'; end if;
  perform public.my_membership();
  select * into m from memberships where user_id = uid for update;
  if coalesce((b ->> 'used_credit')::boolean, false) then
    if m.plan <> 'payg' and coalesce((m.credits -> t ->> 'used')::int, 0) < coalesce((m.credits -> t ->> 'of')::int, 0) then
      src := 'plan';
      update memberships set credits = jsonb_set(credits, array[t, 'used'], to_jsonb(coalesce((credits -> t ->> 'used')::int, 0) + 1)), updated_at = now() where user_id = uid;
    elsif coalesce((m.gifts ->> t)::int, 0) > 0 then
      src := 'gift';
      update memberships set gifts = jsonb_set(gifts, array[t], to_jsonb((gifts ->> t)::int - 1)), updated_at = now() where user_id = uid;
    else
      raise exception 'no_credit' using errcode = 'P0001';
    end if;
  end if;
  select trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), vehicle_label into who, car from profiles where id = uid;
  insert into bookings (user_id, tier, size, tee_time, stall, keys, addons, paid, used_credit, credit_source, payment_method, payment_ref, member_name, vehicle_label)
  values (uid, t, b ->> 'size', tee, upper(coalesce(b ->> 'stall', '')), coalesce(b ->> 'keys', 'proshop'),
          coalesce(array(select jsonb_array_elements_text(b -> 'addons')), '{}'),
          case when src is null then coalesce((b ->> 'paid')::numeric, 0) else coalesce((b ->> 'paid')::numeric, 0) end,
          src is not null, src, nullif(b ->> 'payment_method', ''), nullif(b ->> 'payment_ref', ''), nullif(who, ''), car)
  returning * into row;
  insert into booking_updates (booking_id, user_id, kind, message) values (row.id, uid, 'booked', 'Booked. See you at the course.');
  return row;
end $$;

-- Cancel my booking: free up to 2 hours before tee time (refund, or the free wash comes back).
-- Later: the pass credit or gifted wash is used, or a $20 late fee is kept.
create or replace function public.cancel_booking(booking text) returns jsonb
language plpgsql security definer volatile set search_path = public as $$
declare uid uuid := public.require_member(); row bookings; hours numeric; back numeric; msg text; returned boolean := false;
begin
  select * into row from bookings where id = booking and user_id = uid for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if row.status <> 'booked' then raise exception 'cannot_cancel' using errcode = 'P0001'; end if;
  hours := extract(epoch from (row.tee_time - now())) / 3600;
  if hours >= 2 then
    back := row.paid - row.refund;
    if row.used_credit then
      returned := true;
      if row.credit_source = 'gift' then
        update memberships set gifts = jsonb_set(gifts, array[row.tier], to_jsonb(coalesce((gifts ->> row.tier)::int, 0) + 1)), updated_at = now() where user_id = uid;
      else
        update memberships set credits = jsonb_set(credits, array[row.tier, 'used'], to_jsonb(greatest(coalesce((credits -> row.tier ->> 'used')::int, 0) - 1, 0))), updated_at = now() where user_id = uid;
      end if;
    end if;
    msg := case when returned then 'Cancelled. Your free wash is back.' else format('Cancelled. $%s refunded.', to_char(back, 'FM999990.00')) end;
  else
    back := case when row.used_credit then 0 else greatest(row.paid - row.refund - least(20, row.paid), 0) end;
    msg := case when row.used_credit then 'Cancelled. The free wash was used.' else format('Cancelled. $%s refunded after the late fee.', to_char(back, 'FM999990.00')) end;
  end if;
  update bookings set status = 'cancelled', cancelled_by = 'member', refund = refund + back where id = row.id;
  insert into booking_updates (booking_id, user_id, kind, message) values (row.id, uid, 'cancelled', msg);
  return jsonb_build_object('message', msg, 'refund', back, 'payment_ref', row.payment_ref, 'credit_returned', returned);
end $$;

grant execute on function public.my_membership() to authenticated;
grant execute on function public.set_plan(text) to authenticated;
grant execute on function public.create_booking(jsonb) to authenticated;
grant execute on function public.cancel_booking(text) to authenticated;
revoke execute on function public.require_member() from public, anon;
