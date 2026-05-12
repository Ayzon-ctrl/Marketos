-- MarketOS: Import-Tabelle sauber in locations übernehmen und danach entfernen
--
-- Ziel:
-- Eine einzige produktive Ortstabelle behalten: public.locations
-- Die temporäre Tabelle public.locations_from_anschriften_import wird nach erfolgreicher Übernahme gelöscht.

alter table public.locations
  add column if not exists ags text,
  add column if not exists ars text,
  add column if not exists postal_code text,
  add column if not exists municipality_type text,
  add column if not exists population integer,
  add column if not exists source text default 'manual',
  add column if not exists source_date date;

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

drop table if exists public.locations_from_anschriften_import;

select count(*) as locations_count
from public.locations;
