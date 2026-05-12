-- MarketOS: Import der extrahierten Gemeinden aus dem Anschriftenverzeichnis
--
-- Zugehörige CSV:
-- supabase/locations_from_anschriften.csv
--
-- Ablauf in Supabase:
-- 1. Dieses Script vollständig ausführen.
-- 2. Table Editor -> locations_from_anschriften_import öffnen.
-- 3. CSV "locations_from_anschriften.csv" importieren.
-- 4. Den INSERT-Block unten erneut ausführen, falls er beim ersten Lauf noch keine Daten übernommen hat.

alter table public.locations
  add column if not exists ags text,
  add column if not exists ars text,
  add column if not exists postal_code text,
  add column if not exists municipality_type text,
  add column if not exists population integer,
  add column if not exists source text default 'manual',
  add column if not exists source_date date;

-- Das Anschriftenverzeichnis enthält Name und PLZ, aber keine Koordinaten.
-- Keine Fake-Koordinaten eintragen: lat/lng bleiben bis zum Geocoding leer.
alter table public.locations
  alter column lat drop not null,
  alter column lng drop not null;

create unique index if not exists locations_ags_unique
on public.locations (ags)
where ags is not null;

create index if not exists locations_name_lower_idx
on public.locations (lower(name));

create index if not exists locations_postal_code_idx
on public.locations (postal_code);

create table if not exists public.locations_from_anschriften_import (
  name text not null,
  postal_code text,
  state text,
  country_code text not null default 'DE',
  ags text not null,
  ars text,
  municipality_type text,
  population integer,
  source text not null default 'destatis-anschriftenverzeichnis-2023-01-31',
  source_date date
);

alter table public.locations_from_anschriften_import enable row level security;

drop policy if exists "locations_from_anschriften_import_read" on public.locations_from_anschriften_import;
create policy "locations_from_anschriften_import_read"
on public.locations_from_anschriften_import
for select
using (true);

insert into public.locations (
  name,
  slug,
  state,
  country_code,
  postal_code,
  lat,
  lng,
  ags,
  ars,
  municipality_type,
  population,
  source,
  source_date
)
select
  trim(name),
  'de-' || trim(ags),
  nullif(trim(state), ''),
  coalesce(nullif(trim(country_code), ''), 'DE'),
  nullif(trim(postal_code), ''),
  null,
  null,
  trim(ags),
  nullif(trim(ars), ''),
  nullif(trim(municipality_type), ''),
  population,
  coalesce(nullif(trim(source), ''), 'destatis-anschriftenverzeichnis-2023-01-31'),
  source_date
from public.locations_from_anschriften_import
where trim(name) <> ''
  and trim(ags) <> ''
on conflict (ags) where ags is not null do update set
  name = excluded.name,
  state = excluded.state,
  country_code = excluded.country_code,
  postal_code = excluded.postal_code,
  ars = excluded.ars,
  municipality_type = excluded.municipality_type,
  population = excluded.population,
  source = excluded.source,
  source_date = excluded.source_date;
