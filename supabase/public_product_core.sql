create extension if not exists pgcrypto;

alter table public.profiles
  add column if not exists display_name text,
  add column if not exists has_seen_style_guide boolean default false;

update public.profiles
set has_seen_style_guide = false
where has_seen_style_guide is null;

alter table public.events
  add column if not exists opening_time time,
  add column if not exists closing_time time,
  add column if not exists is_indoor boolean not null default false,
  add column if not exists is_outdoor boolean not null default true,
  add column if not exists is_covered boolean not null default false,
  add column if not exists is_accessible boolean not null default false,
  add column if not exists has_parking boolean not null default false,
  add column if not exists has_toilets boolean not null default false,
  add column if not exists has_food boolean not null default false,
  add column if not exists public_description text,
  add column if not exists public_visible boolean not null default false;

alter table public.events
  add column if not exists location_id uuid references public.locations(id);

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

create table if not exists public.vendor_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  business_name text not null,
  category text,
  description text,
  website_url text,
  instagram_url text,
  facebook_url text,
  tiktok_url text,
  logo_url text,
  public_visible boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.vendor_images (
  id uuid primary key default gen_random_uuid(),
  vendor_profile_id uuid not null references public.vendor_profiles(id) on delete cascade,
  image_url text not null,
  caption text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.visitor_favorite_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, event_id)
);

create table if not exists public.visitor_favorite_vendors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  vendor_profile_id uuid not null references public.vendor_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, vendor_profile_id)
);

create table if not exists public.public_updates (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  vendor_profile_id uuid references public.vendor_profiles(id) on delete cascade,
  title text not null,
  body text not null,
  public_visible boolean not null default true,
  created_at timestamptz not null default now(),
  constraint public_updates_target_check check (
    ((event_id is not null)::int + (vendor_profile_id is not null)::int) = 1
  )
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists events_public_visible_event_date_idx
  on public.events (public_visible, event_date);

create index if not exists event_exhibitor_info_event_id_idx
  on public.event_exhibitor_info (event_id);

create index if not exists vendor_profiles_owner_id_idx
  on public.vendor_profiles (owner_id);

create index if not exists vendor_profiles_public_visible_idx
  on public.vendor_profiles (public_visible, business_name);

create index if not exists vendor_images_vendor_profile_sort_idx
  on public.vendor_images (vendor_profile_id, sort_order);

create index if not exists visitor_favorite_events_user_idx
  on public.visitor_favorite_events (user_id, created_at desc);

create index if not exists visitor_favorite_vendors_user_idx
  on public.visitor_favorite_vendors (user_id, created_at desc);

create index if not exists public_updates_event_idx
  on public.public_updates (event_id, created_at desc);

create index if not exists public_updates_vendor_idx
  on public.public_updates (vendor_profile_id, created_at desc);

create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);

alter table public.vendor_profiles enable row level security;
alter table public.vendor_images enable row level security;
alter table public.visitor_favorite_events enable row level security;
alter table public.visitor_favorite_vendors enable row level security;
alter table public.public_updates enable row level security;
alter table public.notifications enable row level security;
alter table public.event_exhibitor_info enable row level security;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('organizer', 'exhibitor', 'both', 'visitor'));

drop policy if exists "events_public_read" on public.events;
create policy "events_public_read"
on public.events
for select
using (public_visible = true);

drop policy if exists "event_exhibitor_info_owner_select" on public.event_exhibitor_info;
create policy "event_exhibitor_info_owner_select"
on public.event_exhibitor_info
for select
using (
  exists (
    select 1
    from public.events e
    where e.id = event_exhibitor_info.event_id
      and e.organizer_id = auth.uid()
  )
);

drop policy if exists "event_exhibitor_info_owner_insert" on public.event_exhibitor_info;
create policy "event_exhibitor_info_owner_insert"
on public.event_exhibitor_info
for insert
with check (
  exists (
    select 1
    from public.events e
    where e.id = event_exhibitor_info.event_id
      and e.organizer_id = auth.uid()
  )
);

drop policy if exists "event_exhibitor_info_owner_update" on public.event_exhibitor_info;
create policy "event_exhibitor_info_owner_update"
on public.event_exhibitor_info
for update
using (
  exists (
    select 1
    from public.events e
    where e.id = event_exhibitor_info.event_id
      and e.organizer_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.events e
    where e.id = event_exhibitor_info.event_id
      and e.organizer_id = auth.uid()
  )
);

drop policy if exists "event_exhibitor_info_owner_delete" on public.event_exhibitor_info;
create policy "event_exhibitor_info_owner_delete"
on public.event_exhibitor_info
for delete
using (
  exists (
    select 1
    from public.events e
    where e.id = event_exhibitor_info.event_id
      and e.organizer_id = auth.uid()
  )
);

drop policy if exists "vendor_profiles_public_read" on public.vendor_profiles;
create policy "vendor_profiles_public_read"
on public.vendor_profiles
for select
using (public_visible = true);

drop policy if exists "vendor_profiles_owner_select" on public.vendor_profiles;
create policy "vendor_profiles_owner_select"
on public.vendor_profiles
for select
using (owner_id = auth.uid());

drop policy if exists "vendor_profiles_owner_insert" on public.vendor_profiles;
create policy "vendor_profiles_owner_insert"
on public.vendor_profiles
for insert
with check (owner_id = auth.uid());

drop policy if exists "vendor_profiles_owner_update" on public.vendor_profiles;
create policy "vendor_profiles_owner_update"
on public.vendor_profiles
for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "vendor_profiles_owner_delete" on public.vendor_profiles;
create policy "vendor_profiles_owner_delete"
on public.vendor_profiles
for delete
using (owner_id = auth.uid());

drop policy if exists "vendor_images_public_read" on public.vendor_images;
create policy "vendor_images_public_read"
on public.vendor_images
for select
using (
  exists (
    select 1
    from public.vendor_profiles vp
    where vp.id = vendor_images.vendor_profile_id
      and vp.public_visible = true
  )
);

drop policy if exists "vendor_images_owner_all" on public.vendor_images;
create policy "vendor_images_owner_all"
on public.vendor_images
for all
using (
  exists (
    select 1
    from public.vendor_profiles vp
    where vp.id = vendor_images.vendor_profile_id
      and vp.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.vendor_profiles vp
    where vp.id = vendor_images.vendor_profile_id
      and vp.owner_id = auth.uid()
  )
);

drop policy if exists "favorite_events_select_own" on public.visitor_favorite_events;
create policy "favorite_events_select_own"
on public.visitor_favorite_events
for select
using (user_id = auth.uid());

drop policy if exists "favorite_events_insert_own" on public.visitor_favorite_events;
create policy "favorite_events_insert_own"
on public.visitor_favorite_events
for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.events e
    where e.id = visitor_favorite_events.event_id
      and e.public_visible = true
  )
);

drop policy if exists "favorite_events_delete_own" on public.visitor_favorite_events;
create policy "favorite_events_delete_own"
on public.visitor_favorite_events
for delete
using (user_id = auth.uid());

drop policy if exists "favorite_vendors_select_own" on public.visitor_favorite_vendors;
create policy "favorite_vendors_select_own"
on public.visitor_favorite_vendors
for select
using (user_id = auth.uid());

drop policy if exists "favorite_vendors_insert_own" on public.visitor_favorite_vendors;
create policy "favorite_vendors_insert_own"
on public.visitor_favorite_vendors
for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.vendor_profiles vp
    where vp.id = visitor_favorite_vendors.vendor_profile_id
      and vp.public_visible = true
  )
);

drop policy if exists "favorite_vendors_delete_own" on public.visitor_favorite_vendors;
create policy "favorite_vendors_delete_own"
on public.visitor_favorite_vendors
for delete
using (user_id = auth.uid());

drop policy if exists "public_updates_public_read" on public.public_updates;
create policy "public_updates_public_read"
on public.public_updates
for select
using (
  public_visible = true
  and (
    (event_id is not null and exists (
      select 1
      from public.events e
      where e.id = public_updates.event_id
        and e.public_visible = true
    ))
    or
    (vendor_profile_id is not null and exists (
      select 1
      from public.vendor_profiles vp
      where vp.id = public_updates.vendor_profile_id
        and vp.public_visible = true
    ))
  )
);

drop policy if exists "public_updates_owner_select" on public.public_updates;
create policy "public_updates_owner_select"
on public.public_updates
for select
using (
  (event_id is not null and exists (
    select 1 from public.events e
    where e.id = public_updates.event_id
      and e.organizer_id = auth.uid()
  ))
  or
  (vendor_profile_id is not null and exists (
    select 1 from public.vendor_profiles vp
    where vp.id = public_updates.vendor_profile_id
      and vp.owner_id = auth.uid()
  ))
);

drop policy if exists "public_updates_owner_insert" on public.public_updates;
create policy "public_updates_owner_insert"
on public.public_updates
for insert
with check (
  author_id = auth.uid()
  and (
    (event_id is not null and exists (
      select 1 from public.events e
      where e.id = public_updates.event_id
        and e.organizer_id = auth.uid()
    ))
    or
    (vendor_profile_id is not null and exists (
      select 1 from public.vendor_profiles vp
      where vp.id = public_updates.vendor_profile_id
        and vp.owner_id = auth.uid()
    ))
  )
);

drop policy if exists "public_updates_owner_update" on public.public_updates;
create policy "public_updates_owner_update"
on public.public_updates
for update
using (
  (event_id is not null and exists (
    select 1 from public.events e
    where e.id = public_updates.event_id
      and e.organizer_id = auth.uid()
  ))
  or
  (vendor_profile_id is not null and exists (
    select 1 from public.vendor_profiles vp
    where vp.id = public_updates.vendor_profile_id
      and vp.owner_id = auth.uid()
  ))
)
with check (
  author_id = auth.uid()
  and (
    (event_id is not null and exists (
      select 1 from public.events e
      where e.id = public_updates.event_id
        and e.organizer_id = auth.uid()
    ))
    or
    (vendor_profile_id is not null and exists (
      select 1 from public.vendor_profiles vp
      where vp.id = public_updates.vendor_profile_id
        and vp.owner_id = auth.uid()
    ))
  )
);

drop policy if exists "public_updates_owner_delete" on public.public_updates;
create policy "public_updates_owner_delete"
on public.public_updates
for delete
using (
  (event_id is not null and exists (
    select 1 from public.events e
    where e.id = public_updates.event_id
      and e.organizer_id = auth.uid()
  ))
  or
  (vendor_profile_id is not null and exists (
    select 1 from public.vendor_profiles vp
    where vp.id = public_updates.vendor_profile_id
      and vp.owner_id = auth.uid()
  ))
);

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
on public.notifications
for select
using (user_id = auth.uid());

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
on public.notifications
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "notifications_delete_own" on public.notifications;
create policy "notifications_delete_own"
on public.notifications
for delete
using (user_id = auth.uid());

drop function if exists public.handle_public_update_notifications();
create or replace function public.handle_public_update_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.public_visible = false then
    return new;
  end if;

  if new.event_id is not null then
    insert into public.notifications (user_id, title, body)
    select distinct
      favorites.user_id,
      new.title,
      'Neues Update zu deinem gespeicherten Markt: ' || new.body
    from public.visitor_favorite_events favorites
    where favorites.event_id = new.event_id;
  end if;

  if new.vendor_profile_id is not null then
    insert into public.notifications (user_id, title, body)
    select distinct
      favorites.user_id,
      new.title,
      'Neues Update zu deinem gespeicherten Haendler: ' || new.body
    from public.visitor_favorite_vendors favorites
    where favorites.vendor_profile_id = new.vendor_profile_id;
  end if;

  return new;
end;
$$;

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

drop trigger if exists public_updates_create_notifications on public.public_updates;
create trigger public_updates_create_notifications
after insert on public.public_updates
for each row
execute function public.handle_public_update_notifications();

-- ---------------------------------------------------------------------------
-- F1.2: Standoptionen, Preisranges und Zusatzoptionen
-- Fuer das Datenmodell zu Stand- und Preisoptionen bitte zusaetzlich
-- supabase/event_stand_pricing.sql ausfuehren.
-- ---------------------------------------------------------------------------
