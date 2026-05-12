-- MarketOS: Vollständige Städte-/Gemeinde-Datenbasis vorbereiten
--
-- Quelle:
-- Destatis / GV-ISys, Regionales Gemeindeverzeichnis
-- https://www.destatis.de/DE/Themen/Laender-Regionen/Regionales/Gemeindeverzeichnis/_inhalt.html
--
-- Destatis führt jede politisch selbstständige Gemeinde Deutschlands mit AGS,
-- Gemeindename, PLZ des Verwaltungssitzes, Fläche, Einwohnerzahl und weiteren
-- Merkmalen. Die aktuellen Quartals-/Jahresdateien liegen dort im Excel-Format.
--
-- Vorgehen:
-- 1. Aktuelle Destatis-GV-ISys-Datei herunterladen.
-- 2. Auf die Spalten unten normalisieren und als CSV exportieren.
-- 3. CSV in public.locations_import importieren.
-- 4. Dieses Script vollständig ausführen. Es übernimmt die Daten nach locations.

alter table public.locations
  add column if not exists ags text,
  add column if not exists ars text,
  add column if not exists postal_code text,
  add column if not exists municipality_type text,
  add column if not exists population integer,
  add column if not exists source text default 'manual',
  add column if not exists source_date date;

create unique index if not exists locations_ags_unique
on public.locations (ags)
where ags is not null;

create index if not exists locations_name_lower_idx
on public.locations (lower(name));

create index if not exists locations_postal_code_idx
on public.locations (postal_code);

create index if not exists locations_country_state_idx
on public.locations (country_code, state);

create table if not exists public.locations_import (
  name text not null,
  state text,
  country_code text not null default 'DE',
  ags text,
  ars text,
  postal_code text,
  lat numeric(9,6) not null,
  lng numeric(9,6) not null,
  municipality_type text,
  population integer,
  source text not null default 'destatis-gv-isys',
  source_date date
);

-- Nach dem CSV-Import in public.locations_import diesen Block erneut ausführen
-- oder ab hier markieren und starten.
insert into public.locations (
  name,
  slug,
  state,
  country_code,
  lat,
  lng,
  ags,
  ars,
  postal_code,
  municipality_type,
  population,
  source,
  source_date
)
select
  trim(name),
  lower(
    regexp_replace(
      regexp_replace(trim(name), '[^[:alnum:]]+', '-', 'g'),
      '(^-|-$)', '', 'g'
    )
  ) || '-' || coalesce(nullif(trim(ags), ''), country_code),
  nullif(trim(state), ''),
  coalesce(nullif(trim(country_code), ''), 'DE'),
  lat,
  lng,
  nullif(trim(ags), ''),
  nullif(trim(ars), ''),
  nullif(trim(postal_code), ''),
  nullif(trim(municipality_type), ''),
  population,
  coalesce(nullif(trim(source), ''), 'destatis-gv-isys'),
  source_date
from public.locations_import
where trim(name) <> ''
on conflict (ags) where ags is not null do update set
  name = excluded.name,
  state = excluded.state,
  country_code = excluded.country_code,
  lat = excluded.lat,
  lng = excluded.lng,
  ars = excluded.ars,
  postal_code = excluded.postal_code,
  municipality_type = excluded.municipality_type,
  population = excluded.population,
  source = excluded.source,
  source_date = excluded.source_date;
