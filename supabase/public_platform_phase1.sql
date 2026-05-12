create extension if not exists pgcrypto;

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

create index if not exists events_public_visible_event_date_idx
  on public.events (public_visible, event_date);

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

create index if not exists vendor_profiles_owner_id_idx
  on public.vendor_profiles (owner_id);

create index if not exists vendor_profiles_public_visible_idx
  on public.vendor_profiles (public_visible, business_name);

create table if not exists public.vendor_images (
  id uuid primary key default gen_random_uuid(),
  vendor_profile_id uuid not null references public.vendor_profiles(id) on delete cascade,
  image_url text not null,
  caption text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists vendor_images_vendor_profile_sort_idx
  on public.vendor_images (vendor_profile_id, sort_order);

alter table public.vendor_profiles enable row level security;
alter table public.vendor_images enable row level security;

drop policy if exists "events_public_read" on public.events;
create policy "events_public_read"
on public.events
for select
using (public_visible = true);

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

drop function if exists public.get_public_event_vendors(uuid);
create or replace function public.get_public_event_vendors(p_event_id uuid default null)
returns table (
  event_id uuid,
  vendor_profile_id uuid,
  business_name text,
  category text,
  description text,
  logo_url text,
  instagram_url text,
  website_url text,
  facebook_url text,
  tiktok_url text
)
language sql
security definer
set search_path = public
as $$
  select distinct
    ep.event_id,
    vp.id as vendor_profile_id,
    vp.business_name,
    vp.category,
    vp.description,
    vp.logo_url,
    vp.instagram_url,
    vp.website_url,
    vp.facebook_url,
    vp.tiktok_url
  from public.event_participants ep
  join public.events e
    on e.id = ep.event_id
  join public.vendor_profiles vp
    on vp.owner_id = ep.exhibitor_id
  where e.public_visible = true
    and vp.public_visible = true
    and (p_event_id is null or ep.event_id = p_event_id);
$$;

revoke all on function public.get_public_event_vendors(uuid) from public;
grant execute on function public.get_public_event_vendors(uuid) to anon, authenticated;

drop function if exists public.get_public_vendor_events(uuid);
create or replace function public.get_public_vendor_events(p_vendor_profile_id uuid default null)
returns table (
  vendor_profile_id uuid,
  event_id uuid,
  title text,
  event_date date,
  location text,
  opening_time time,
  closing_time time
)
language sql
security definer
set search_path = public
as $$
  select distinct
    vp.id as vendor_profile_id,
    e.id as event_id,
    e.title,
    e.event_date,
    e.location,
    e.opening_time,
    e.closing_time
  from public.vendor_profiles vp
  join public.event_participants ep
    on ep.exhibitor_id = vp.owner_id
  join public.events e
    on e.id = ep.event_id
  where vp.public_visible = true
    and e.public_visible = true
    and (p_vendor_profile_id is null or vp.id = p_vendor_profile_id)
    and e.event_date >= current_date
  order by e.event_date asc;
$$;

revoke all on function public.get_public_vendor_events(uuid) from public;
grant execute on function public.get_public_vendor_events(uuid) to anon, authenticated;
