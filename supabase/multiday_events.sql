-- ============================================================
-- UX2.6.2: Mehrtägige Events und relative Aufbau-/Abbauzeiten
-- ============================================================
-- Voraussetzungen (müssen bereits ausgeführt sein):
--   schema.sql
--   public_platform_phase1.sql
--   event_exhibitor_info.sql
--
-- Idempotenz: Dieses Skript kann sicher mehrfach ausgeführt
-- werden. Alle Statements nutzen IF NOT EXISTS / IF EXISTS.
--
-- Datenverlust: Kein einziger bestehender Datensatz wird
-- verändert oder gelöscht. Neue Spalten sind nullable oder
-- haben sichere Defaults.
--
-- RLS: Keine bestehende Policy wird verändert. Keine neue
-- Public-Read-Policy wird eingeführt. Bestehende Policies
-- auf events und event_exhibitor_info greifen automatisch
-- auf die neuen Spalten.
-- ============================================================


-- ------------------------------------------------------------
-- 1. events.end_date
-- ------------------------------------------------------------
-- nullable → bestehende Events bleiben eintägig (end_date = NULL)
-- Semantik: NULL bedeutet "eintägig", Wert = letzter Eventtag
-- ------------------------------------------------------------

alter table public.events
  add column if not exists end_date date;

-- Check-Constraint idempotent:
-- drop if exists verhindert Fehler bei Wiederholung
alter table public.events
  drop constraint if exists events_end_date_gte_event_date;

alter table public.events
  add constraint events_end_date_gte_event_date
  check (end_date is null or end_date >= event_date);

-- Index für zukünftige Range-Queries
create index if not exists events_end_date_idx
  on public.events (end_date)
  where end_date is not null;


-- ------------------------------------------------------------
-- 2. event_exhibitor_info.setup_day_offset
-- ------------------------------------------------------------
--   0  = Aufbau am Eventtag (event_date)        ← Default
--  -1  = Aufbau am Vortag
--  -2  = Aufbau zwei Tage vor dem Event
-- NOT NULL DEFAULT 0 → bestehende Zeilen behalten Offset 0
-- (= Eventtag = bisheriger impliziter Stand, semantisch korrekt)
-- ------------------------------------------------------------

alter table public.event_exhibitor_info
  add column if not exists setup_day_offset
    smallint not null default 0;


-- ------------------------------------------------------------
-- 3. event_exhibitor_info.teardown_day_offset
-- ------------------------------------------------------------
--   0  = Abbau am letzten Eventtag (end_date ?? event_date)  ← Default
--  +1  = Abbau am Folgetag
--  +2  = Abbau zwei Tage nach dem letzten Eventtag
-- NOT NULL DEFAULT 0 → bestehende Zeilen behalten Offset 0
-- ------------------------------------------------------------

alter table public.event_exhibitor_info
  add column if not exists teardown_day_offset
    smallint not null default 0;


-- ------------------------------------------------------------
-- 4. get_public_vendor_events(uuid) – aktualisierte Version
-- ------------------------------------------------------------
-- RETURNS TABLE enthält jetzt end_date.
-- PostgreSQL erlaubt keine direkte Änderung der RETURNS TABLE-
-- Signatur mit CREATE OR REPLACE, daher DROP + Recreate.
-- Die Funktion ist SECURITY DEFINER, kein Zustand geht verloren.
-- Der Filter ist range-aware:
--   coalesce(end_date, event_date) >= current_date
-- → mehrtägige Events bleiben sichtbar bis ihr letzter Tag.
-- ------------------------------------------------------------

drop function if exists public.get_public_vendor_events(uuid);

create function public.get_public_vendor_events(
  p_vendor_profile_id uuid default null
)
returns table (
  vendor_profile_id uuid,
  event_id          uuid,
  title             text,
  event_date        date,
  end_date          date,
  location          text,
  opening_time      time,
  closing_time      time
)
language sql
security definer
set search_path = public
as $$
  select distinct
    vp.id  as vendor_profile_id,
    e.id   as event_id,
    e.title,
    e.event_date,
    e.end_date,
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
    and coalesce(e.end_date, e.event_date) >= current_date
  order by e.event_date asc;
$$;

revoke all   on function public.get_public_vendor_events(uuid) from public;
grant execute on function public.get_public_vendor_events(uuid) to anon, authenticated;
