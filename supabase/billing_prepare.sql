create extension if not exists pgcrypto;

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  plan text default 'free',
  status text default 'free',
  trial_starts_at timestamptz,
  trial_ends_at timestamptz,
  current_period_starts_at timestamptz,
  current_period_ends_at timestamptz,
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.subscriptions
  add column if not exists profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists plan text default 'free',
  add column if not exists status text default 'free',
  add column if not exists trial_starts_at timestamptz,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists current_period_starts_at timestamptz,
  add column if not exists current_period_ends_at timestamptz,
  add column if not exists provider text,
  add column if not exists provider_customer_id text,
  add column if not exists provider_subscription_id text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  provider text default 'stripe',
  provider_event_id text,
  event_type text,
  payload jsonb,
  created_at timestamptz default now()
);

alter table public.billing_events
  add column if not exists profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists provider text default 'stripe',
  add column if not exists provider_event_id text,
  add column if not exists event_type text,
  add column if not exists payload jsonb,
  add column if not exists created_at timestamptz default now();

create index if not exists subscriptions_profile_id_idx
  on public.subscriptions (profile_id);

create index if not exists billing_events_profile_id_idx
  on public.billing_events (profile_id, created_at desc);

alter table public.subscriptions enable row level security;
alter table public.billing_events enable row level security;

drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own"
on public.subscriptions
for select
using (profile_id = auth.uid());

drop policy if exists "billing_events_select_own" on public.billing_events;
create policy "billing_events_select_own"
on public.billing_events
for select
using (profile_id = auth.uid());

create or replace function public.set_subscriptions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
before update on public.subscriptions
for each row
execute function public.set_subscriptions_updated_at();
