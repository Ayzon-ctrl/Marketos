-- MarketOS V1 Supabase schema
-- 1) In Supabase öffnen: SQL Editor -> New query
-- 2) Alles einfügen
-- 3) Run klicken

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  display_name text,
  company_name text,
  role text not null default 'exhibitor' check (role in ('organizer','exhibitor','both')),
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  event_date date not null,
  location text,
  description text,
  status text not null default 'open' check (status in ('draft','open','full','waitlist','done','cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.event_exhibitor_info (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  setup_start_time time,
  setup_end_time time,
  teardown_start_time time,
  teardown_end_time time,
  arrival_notes text,
  access_notes text,
  exhibitor_contact_name text,
  exhibitor_contact_phone text,
  emergency_contact_name text,
  emergency_contact_phone text,
  power_notes text,
  parking_notes text,
  waste_notes text,
  exhibitor_general_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id)
);

create table if not exists public.event_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  exhibitor_id uuid references public.profiles(id) on delete set null,
  exhibitor_name text not null,
  email text,
  status text not null default 'angefragt',
  paid boolean not null default false,
  booth text,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  title text not null,
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  scope text not null default 'own' check (scope in ('own','team')),
  due_date date,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  subject text not null,
  body text not null,
  send_offset_days integer not null default 2,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  organization_score integer not null check (organization_score between 1 and 5),
  visitors_score integer not null check (visitors_score between 1 and 5),
  infrastructure_score integer not null check (infrastructure_score between 1 and 5),
  comment text,
  anonymous_public boolean not null default true,
  created_at timestamptz not null default now(),
  unique(event_id, reviewer_id)
);

create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  title text not null,
  file_path text,
  status text not null default 'uploaded' check (status in ('uploaded','review','signed','archived')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.event_exhibitor_info enable row level security;
alter table public.event_participants enable row level security;
alter table public.tasks enable row level security;
alter table public.announcements enable row level security;
alter table public.email_templates enable row level security;
alter table public.reviews enable row level security;
alter table public.contracts enable row level security;

-- RLS policies. Für MVP bewusst einfach, aber nicht komplett offen wie ein Scheunentor.

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "events_owner_all" on public.events;
create policy "events_owner_all" on public.events for all using (auth.uid() = organizer_id) with check (auth.uid() = organizer_id);

drop policy if exists "events_participant_read" on public.events;
create policy "events_participant_read" on public.events for select using (
  exists (
    select 1 from public.event_participants ep
    where ep.event_id = events.id and ep.exhibitor_id = auth.uid()
  )
);

drop policy if exists "event_exhibitor_info_owner_select" on public.event_exhibitor_info;
create policy "event_exhibitor_info_owner_select" on public.event_exhibitor_info for select using (
  exists (
    select 1 from public.events e
    where e.id = event_exhibitor_info.event_id
      and e.organizer_id = auth.uid()
  )
);

drop policy if exists "event_exhibitor_info_owner_insert" on public.event_exhibitor_info;
create policy "event_exhibitor_info_owner_insert" on public.event_exhibitor_info for insert with check (
  exists (
    select 1 from public.events e
    where e.id = event_exhibitor_info.event_id
      and e.organizer_id = auth.uid()
  )
);

drop policy if exists "event_exhibitor_info_owner_update" on public.event_exhibitor_info;
create policy "event_exhibitor_info_owner_update" on public.event_exhibitor_info for update using (
  exists (
    select 1 from public.events e
    where e.id = event_exhibitor_info.event_id
      and e.organizer_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.events e
    where e.id = event_exhibitor_info.event_id
      and e.organizer_id = auth.uid()
  )
);

drop policy if exists "event_exhibitor_info_owner_delete" on public.event_exhibitor_info;
create policy "event_exhibitor_info_owner_delete" on public.event_exhibitor_info for delete using (
  exists (
    select 1 from public.events e
    where e.id = event_exhibitor_info.event_id
      and e.organizer_id = auth.uid()
  )
);

drop policy if exists "participants_organizer_all" on public.event_participants;
create policy "participants_organizer_all" on public.event_participants for all using (
  exists(select 1 from public.events e where e.id = event_participants.event_id and e.organizer_id = auth.uid())
) with check (
  exists(select 1 from public.events e where e.id = event_participants.event_id and e.organizer_id = auth.uid())
);

drop policy if exists "participants_exhibitor_read" on public.event_participants;
create policy "participants_exhibitor_read" on public.event_participants for select using (exhibitor_id = auth.uid());

drop policy if exists "tasks_owner_all" on public.tasks;
create policy "tasks_owner_all" on public.tasks for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "announcements_organizer_all" on public.announcements;
create policy "announcements_organizer_all" on public.announcements for all using (
  exists(select 1 from public.events e where e.id = announcements.event_id and e.organizer_id = auth.uid())
) with check (
  exists(select 1 from public.events e where e.id = announcements.event_id and e.organizer_id = auth.uid())
);

drop policy if exists "announcements_participant_read" on public.announcements;
create policy "announcements_participant_read" on public.announcements for select using (
  exists(select 1 from public.event_participants ep where ep.event_id = announcements.event_id and ep.exhibitor_id = auth.uid())
);

drop policy if exists "email_templates_owner_all" on public.email_templates;
create policy "email_templates_owner_all" on public.email_templates for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "reviews_participant_insert" on public.reviews;
create policy "reviews_participant_insert" on public.reviews for insert with check (
  reviewer_id = auth.uid() and exists(select 1 from public.event_participants ep where ep.event_id = reviews.event_id and ep.exhibitor_id = auth.uid())
);

drop policy if exists "reviews_author_read_update" on public.reviews;
create policy "reviews_author_read_update" on public.reviews for select using (reviewer_id = auth.uid());

drop policy if exists "reviews_organizer_read" on public.reviews;
create policy "reviews_organizer_read" on public.reviews for select using (
  exists(select 1 from public.events e where e.id = reviews.event_id and e.organizer_id = auth.uid())
);

drop policy if exists "contracts_owner_all" on public.contracts;
create policy "contracts_owner_all" on public.contracts for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create or replace function public.set_event_exhibitor_info_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists event_exhibitor_info_set_updated_at on public.event_exhibitor_info;
create trigger event_exhibitor_info_set_updated_at
before update on public.event_exhibitor_info
for each row
execute function public.set_event_exhibitor_info_updated_at();

-- Optional: Demo-Daten werden aus der App per Button erzeugt, weil auth.uid() dafür gebraucht wird.

-- ---------------------------------------------------------------------------
-- F1.2: Standoptionen, Preisranges und Zusatzoptionen
-- Vollstaendige Definition: supabase/event_stand_pricing.sql
-- Die folgenden Bloecke sind identisch mit event_stand_pricing.sql und
-- sorgen dafuer, dass schema.sql als vollstaendige Referenz fuer einen
-- Neuaufbau ausfuehrbar bleibt.
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.event_stand_options (
  id          uuid        primary key default gen_random_uuid(),
  event_id    uuid        not null references public.events(id) on delete cascade,
  label       text        not null,
  description text,
  area_type   text        not null
    check (area_type in (
      'indoor',
      'outdoor',
      'both',
      'covered',
      'partially_covered'
    )),
  surface_types text[]    not null default '{}',
  surface_notes text,
  pricing_type text       not null
    check (pricing_type in (
      'flat',
      'fixed_size',
      'up_to_length',
      'per_meter',
      'per_sqm',
      'base_plus_extra',
      'tiered_length',
      'custom'
    )),
  width_m             numeric(6,2)  check (width_m             >= 0),
  depth_m             numeric(6,2)  check (depth_m             >= 0),
  min_length_m        numeric(6,2)  check (min_length_m        >= 0),
  max_length_m        numeric(6,2)  check (max_length_m        >= 0),
  included_length_m   numeric(6,2)  check (included_length_m   >= 0),
  max_depth_m         numeric(6,2)  check (max_depth_m         >= 0),
  price_cents                 integer  check (price_cents                 >= 0),
  price_per_meter_cents       integer  check (price_per_meter_cents       >= 0),
  price_per_sqm_cents         integer  check (price_per_sqm_cents         >= 0),
  price_per_extra_meter_cents integer  check (price_per_extra_meter_cents >= 0),
  is_price_on_request         boolean  not null default false,
  pricing_description         text,
  is_available    boolean  not null default true,
  public_visible  boolean  not null default false,
  sort_order      integer  not null default 0 check (sort_order >= 0),
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now()
);

create index if not exists event_stand_options_event_id_idx
  on public.event_stand_options (event_id);
create index if not exists event_stand_options_event_id_sort_idx
  on public.event_stand_options (event_id, sort_order);
create index if not exists event_stand_options_event_id_available_idx
  on public.event_stand_options (event_id, is_available);

drop trigger if exists event_stand_options_set_updated_at on public.event_stand_options;
create trigger event_stand_options_set_updated_at
before update on public.event_stand_options
for each row execute function public.set_updated_at();

alter table public.event_stand_options enable row level security;

drop policy if exists "event_stand_options_owner_select" on public.event_stand_options;
create policy "event_stand_options_owner_select"
on public.event_stand_options for select
using (exists (select 1 from public.events e where e.id = event_stand_options.event_id and e.organizer_id = auth.uid()));

drop policy if exists "event_stand_options_owner_insert" on public.event_stand_options;
create policy "event_stand_options_owner_insert"
on public.event_stand_options for insert
with check (exists (select 1 from public.events e where e.id = event_stand_options.event_id and e.organizer_id = auth.uid()));

drop policy if exists "event_stand_options_owner_update" on public.event_stand_options;
create policy "event_stand_options_owner_update"
on public.event_stand_options for update
using (exists (select 1 from public.events e where e.id = event_stand_options.event_id and e.organizer_id = auth.uid()))
with check (exists (select 1 from public.events e where e.id = event_stand_options.event_id and e.organizer_id = auth.uid()));

drop policy if exists "event_stand_options_owner_delete" on public.event_stand_options;
create policy "event_stand_options_owner_delete"
on public.event_stand_options for delete
using (exists (select 1 from public.events e where e.id = event_stand_options.event_id and e.organizer_id = auth.uid()));

create table if not exists public.event_stand_price_tiers (
  id              uuid  primary key default gen_random_uuid(),
  stand_option_id uuid  not null references public.event_stand_options(id) on delete cascade,
  label           text,
  min_length_m    numeric(6,2)  check (min_length_m  >= 0),
  max_length_m    numeric(6,2)  check (max_length_m  >= 0),
  min_depth_m     numeric(6,2)  check (min_depth_m   >= 0),
  max_depth_m     numeric(6,2)  check (max_depth_m   >= 0),
  min_area_sqm    numeric(8,2)  check (min_area_sqm  >= 0),
  max_area_sqm    numeric(8,2)  check (max_area_sqm  >= 0),
  price_cents                 integer  check (price_cents                 >= 0),
  price_per_meter_cents       integer  check (price_per_meter_cents       >= 0),
  price_per_sqm_cents         integer  check (price_per_sqm_cents         >= 0),
  price_per_extra_meter_cents integer  check (price_per_extra_meter_cents >= 0),
  is_price_on_request         boolean  not null default false,
  sort_order  integer  not null default 0 check (sort_order >= 0),
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now()
);

create index if not exists event_stand_price_tiers_stand_option_id_idx
  on public.event_stand_price_tiers (stand_option_id);
create index if not exists event_stand_price_tiers_stand_option_sort_idx
  on public.event_stand_price_tiers (stand_option_id, sort_order);

drop trigger if exists event_stand_price_tiers_set_updated_at on public.event_stand_price_tiers;
create trigger event_stand_price_tiers_set_updated_at
before update on public.event_stand_price_tiers
for each row execute function public.set_updated_at();

alter table public.event_stand_price_tiers enable row level security;

drop policy if exists "event_stand_price_tiers_owner_select" on public.event_stand_price_tiers;
create policy "event_stand_price_tiers_owner_select"
on public.event_stand_price_tiers for select
using (exists (select 1 from public.event_stand_options eso join public.events e on e.id = eso.event_id where eso.id = event_stand_price_tiers.stand_option_id and e.organizer_id = auth.uid()));

drop policy if exists "event_stand_price_tiers_owner_insert" on public.event_stand_price_tiers;
create policy "event_stand_price_tiers_owner_insert"
on public.event_stand_price_tiers for insert
with check (exists (select 1 from public.event_stand_options eso join public.events e on e.id = eso.event_id where eso.id = event_stand_price_tiers.stand_option_id and e.organizer_id = auth.uid()));

drop policy if exists "event_stand_price_tiers_owner_update" on public.event_stand_price_tiers;
create policy "event_stand_price_tiers_owner_update"
on public.event_stand_price_tiers for update
using (exists (select 1 from public.event_stand_options eso join public.events e on e.id = eso.event_id where eso.id = event_stand_price_tiers.stand_option_id and e.organizer_id = auth.uid()))
with check (exists (select 1 from public.event_stand_options eso join public.events e on e.id = eso.event_id where eso.id = event_stand_price_tiers.stand_option_id and e.organizer_id = auth.uid()));

drop policy if exists "event_stand_price_tiers_owner_delete" on public.event_stand_price_tiers;
create policy "event_stand_price_tiers_owner_delete"
on public.event_stand_price_tiers for delete
using (exists (select 1 from public.event_stand_options eso join public.events e on e.id = eso.event_id where eso.id = event_stand_price_tiers.stand_option_id and e.organizer_id = auth.uid()));

create table if not exists public.event_addon_options (
  id        uuid  primary key default gen_random_uuid(),
  event_id  uuid  not null references public.events(id) on delete cascade,
  addon_type text  not null
    check (addon_type in (
      'electricity',
      'water',
      'table',
      'chair',
      'pavilion',
      'waste_fee',
      'cleaning_fee',
      'parking_fee',
      'deposit',
      'other'
    )),
  label       text  not null,
  description text,
  price_cents         integer  check (price_cents >= 0),
  is_price_on_request boolean  not null default false,
  is_available    boolean  not null default true,
  public_visible  boolean  not null default false,
  sort_order      integer  not null default 0 check (sort_order >= 0),
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now()
);

create index if not exists event_addon_options_event_id_idx
  on public.event_addon_options (event_id);
create index if not exists event_addon_options_event_id_sort_idx
  on public.event_addon_options (event_id, sort_order);
create index if not exists event_addon_options_event_id_available_idx
  on public.event_addon_options (event_id, is_available);

drop trigger if exists event_addon_options_set_updated_at on public.event_addon_options;
create trigger event_addon_options_set_updated_at
before update on public.event_addon_options
for each row execute function public.set_updated_at();

alter table public.event_addon_options enable row level security;

drop policy if exists "event_addon_options_owner_select" on public.event_addon_options;
create policy "event_addon_options_owner_select"
on public.event_addon_options for select
using (exists (select 1 from public.events e where e.id = event_addon_options.event_id and e.organizer_id = auth.uid()));

drop policy if exists "event_addon_options_owner_insert" on public.event_addon_options;
create policy "event_addon_options_owner_insert"
on public.event_addon_options for insert
with check (exists (select 1 from public.events e where e.id = event_addon_options.event_id and e.organizer_id = auth.uid()));

drop policy if exists "event_addon_options_owner_update" on public.event_addon_options;
create policy "event_addon_options_owner_update"
on public.event_addon_options for update
using (exists (select 1 from public.events e where e.id = event_addon_options.event_id and e.organizer_id = auth.uid()))
with check (exists (select 1 from public.events e where e.id = event_addon_options.event_id and e.organizer_id = auth.uid()));

drop policy if exists "event_addon_options_owner_delete" on public.event_addon_options;
create policy "event_addon_options_owner_delete"
on public.event_addon_options for delete
using (exists (select 1 from public.events e where e.id = event_addon_options.event_id and e.organizer_id = auth.uid()));
