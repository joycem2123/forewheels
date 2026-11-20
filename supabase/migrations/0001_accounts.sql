-- Fore Wheels: member accounts.
-- Profiles (name, unique username, club number, car), username checks, and sign-in by username.
-- Same account rules as Clutch Up. Apply with the Supabase SQL editor or the management API.

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username text,
  first_name text,
  last_name text,
  club text,
  member_no text,
  vehicle_label text,
  vehicle_plate text,
  vehicle_size text check (vehicle_size in ('car', 'suv')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[a-z0-9_.]{3,20}$')
);
create unique index if not exists profiles_username_unique on public.profiles (lower(username));

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

-- Each member can read and change only their own profile.
alter table public.profiles enable row level security;
drop policy if exists "profiles own read" on public.profiles;
create policy "profiles own read" on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists "profiles own insert" on public.profiles;
create policy "profiles own insert" on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists "profiles own update" on public.profiles;
create policy "profiles own update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Is a username free? (Ignores your own.)
create or replace function public.username_available(u text) returns boolean
language sql security definer stable set search_path = public as $$
  select lower(u) ~ '^[a-z0-9_.]{3,20}$'
     and not exists (select 1 from profiles where lower(username) = lower(u) and id is distinct from auth.uid());
$$;
grant execute on function public.username_available(text) to anon, authenticated;

-- Sign in with a username: returns the account's email ONLY when the password is right,
-- so emails are never revealed to someone who just knows a username.
-- After 5 wrong tries a username is locked for 15 minutes (brute-force protection).
create table if not exists public.login_failures (
  username text not null,
  at timestamptz not null default now()
);
create index if not exists login_failures_username_at on public.login_failures (username, at);
alter table public.login_failures enable row level security; -- no policies: not readable from the app

create or replace function public.login_email(u text, pw text) returns text
language plpgsql security definer volatile set search_path = public, auth, extensions as $$
declare name text := lower(trim(both from replace(coalesce(u, ''), '@', ''))); e text; hash text;
begin
  if (select count(*) from login_failures where username = name and at > now() - interval '15 minutes') >= 5 then
    raise exception 'too_many_attempts' using errcode = 'P0001';
  end if;
  select au.email, au.encrypted_password into e, hash
  from profiles p join auth.users au on au.id = p.id
  where lower(p.username) = name and au.email is not null and au.email <> '' and au.deleted_at is null;
  if e is not null and hash is not null and hash <> '' and extensions.crypt(pw, hash) = hash then
    delete from login_failures where username = name;
    return e;
  end if;
  insert into login_failures (username) values (name);
  delete from login_failures where at < now() - interval '1 day';
  return null;
end $$;
revoke all on function public.login_email(text, text) from public;
grant execute on function public.login_email(text, text) to anon, authenticated;
