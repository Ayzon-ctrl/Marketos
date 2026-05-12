-- F4.2: Öffentliche Security-Definer-RPCs für Standoptionen, Preisranges und Zusatzoptionen
-- Zweck: Whitelisted Public-Zugriff auf freigegebene Standdaten, ohne direkte RLS auf Rohtabellen.
-- Voraussetzung: event_stand_pricing.sql und public_platform_phase1.sql wurden bereits ausgeführt.
-- Die Tabellen selbst bleiben organizer-only. Public-Zugriff erfolgt ausschließlich über diese RPCs.
-- Ausführen: Supabase SQL Editor -> New query -> Alles einfügen -> Run

-- ---------------------------------------------------------------------------
-- RPC 1: get_public_event_stand_options(p_event_id uuid)
-- Zweck: Gibt freigegebene, verfügbare Standoptionen für ein öffentliches Event zurück.
-- Feldwhitelist: Interne Felder (public_visible, sort_order, event_id, created_at, updated_at)
--               werden bewusst nicht ausgegeben.
-- ---------------------------------------------------------------------------

drop function if exists public.get_public_event_stand_options(uuid);
create or replace function public.get_public_event_stand_options(p_event_id uuid)
returns table (
  id                          uuid,
  label                       text,
  description                 text,
  area_type                   text,
  surface_types               text[],
  surface_notes               text,
  pricing_type                text,
  width_m                     numeric,
  depth_m                     numeric,
  min_length_m                numeric,
  max_length_m                numeric,
  included_length_m           numeric,
  max_depth_m                 numeric,
  price_cents                 integer,
  price_per_meter_cents       integer,
  price_per_sqm_cents         integer,
  price_per_extra_meter_cents integer,
  is_price_on_request         boolean,
  pricing_description         text
)
language sql
security definer
set search_path = public
as $$
  select
    eso.id,
    eso.label,
    eso.description,
    eso.area_type,
    eso.surface_types,
    eso.surface_notes,
    eso.pricing_type,
    eso.width_m,
    eso.depth_m,
    eso.min_length_m,
    eso.max_length_m,
    eso.included_length_m,
    eso.max_depth_m,
    eso.price_cents,
    eso.price_per_meter_cents,
    eso.price_per_sqm_cents,
    eso.price_per_extra_meter_cents,
    eso.is_price_on_request,
    eso.pricing_description
  from public.event_stand_options eso
  join public.events e on e.id = eso.event_id
  where eso.event_id = p_event_id
    and eso.is_available = true
    and eso.public_visible = true
    and e.public_visible = true
  order by eso.sort_order asc, eso.label asc;
$$;

revoke all on function public.get_public_event_stand_options(uuid) from public;
grant execute on function public.get_public_event_stand_options(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPC 2: get_public_event_stand_price_tiers(p_event_id uuid)
-- Zweck: Gibt Preisranges für alle public sichtbaren Standoptionen eines öffentlichen Events zurück.
-- stand_option_id wird ausgegeben, damit der Client den clientseitigen Join durchführen kann.
-- Interne Felder (id, sort_order, created_at, updated_at) werden nicht ausgegeben.
-- ---------------------------------------------------------------------------

drop function if exists public.get_public_event_stand_price_tiers(uuid);
create or replace function public.get_public_event_stand_price_tiers(p_event_id uuid)
returns table (
  stand_option_id             uuid,
  label                       text,
  min_length_m                numeric,
  max_length_m                numeric,
  min_depth_m                 numeric,
  max_depth_m                 numeric,
  min_area_sqm                numeric,
  max_area_sqm                numeric,
  price_cents                 integer,
  price_per_meter_cents       integer,
  price_per_sqm_cents         integer,
  price_per_extra_meter_cents integer,
  is_price_on_request         boolean
)
language sql
security definer
set search_path = public
as $$
  select
    t.stand_option_id,
    t.label,
    t.min_length_m,
    t.max_length_m,
    t.min_depth_m,
    t.max_depth_m,
    t.min_area_sqm,
    t.max_area_sqm,
    t.price_cents,
    t.price_per_meter_cents,
    t.price_per_sqm_cents,
    t.price_per_extra_meter_cents,
    t.is_price_on_request
  from public.event_stand_price_tiers t
  join public.event_stand_options eso on eso.id = t.stand_option_id
  join public.events e on e.id = eso.event_id
  where eso.event_id = p_event_id
    and eso.is_available = true
    and eso.public_visible = true
    and e.public_visible = true
  order by eso.sort_order asc, t.sort_order asc;
$$;

revoke all on function public.get_public_event_stand_price_tiers(uuid) from public;
grant execute on function public.get_public_event_stand_price_tiers(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPC 3: get_public_event_addon_options(p_event_id uuid)
-- Zweck: Gibt freigegebene, verfügbare Zusatzoptionen für ein öffentliches Event zurück.
-- Feldwhitelist: Interne Felder (public_visible, sort_order, event_id, created_at, updated_at)
--               werden bewusst nicht ausgegeben.
-- ---------------------------------------------------------------------------

drop function if exists public.get_public_event_addon_options(uuid);
create or replace function public.get_public_event_addon_options(p_event_id uuid)
returns table (
  id                  uuid,
  addon_type          text,
  label               text,
  description         text,
  price_cents         integer,
  is_price_on_request boolean
)
language sql
security definer
set search_path = public
as $$
  select
    eao.id,
    eao.addon_type,
    eao.label,
    eao.description,
    eao.price_cents,
    eao.is_price_on_request
  from public.event_addon_options eao
  join public.events e on e.id = eao.event_id
  where eao.event_id = p_event_id
    and eao.is_available = true
    and eao.public_visible = true
    and e.public_visible = true
  order by eao.sort_order asc, eao.label asc;
$$;

revoke all on function public.get_public_event_addon_options(uuid) from public;
grant execute on function public.get_public_event_addon_options(uuid) to anon, authenticated;
