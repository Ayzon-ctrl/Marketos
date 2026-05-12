-- Saubere Grundlage für alle deutschen Gemeinden/Städte.
-- Wichtig: Nicht per Hand tippen. Quelle: Destatis GV-ISys / amtliches Gemeindeverzeichnis.
-- Dieses Script bereitet die Tabelle für einen vollständigen offiziellen Import vor.
-- Danach importierst du die CSV über Supabase Table Editor -> locations -> Import data from CSV.

alter table public.locations
  add column if not exists ags text,
  add column if not exists postal_code text,
  add column if not exists municipality_type text,
  add column if not exists population integer,
  add column if not exists source text default 'manual',
  add column if not exists source_date date;

create unique index if not exists locations_ags_unique
on public.locations (ags)
where ags is not null;

create index if not exists locations_name_idx
on public.locations (name);

create index if not exists locations_country_state_idx
on public.locations (country_code, state);

-- Für vollständige Deutschland-Abdeckung:
-- 1. Offizielle GV-ISys / Gemeindeverzeichnis Datei von Destatis laden.
-- 2. Auf folgende Spalten mappen:
--    name, slug, state, country_code, ags, postal_code, lat, lng, source, source_date
-- 3. Importieren.
-- 4. Lat/Lng für noch fehlende Orte über einen Geocoder nachziehen.
--
-- Kein Fake-Datensatz. Keine halbe Fantasieliste. Das wäre Datenmüll mit hübscher Verpackung.
