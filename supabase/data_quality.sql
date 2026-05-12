-- Datenqualität für Events.
-- Ziel: Fehlerhafte Alt-Daten sichtbar machen und neue schlechte Daten verhindern.

-- 1) View: zeigt Events mit fehlenden Pflichtfeldern oder ungültiger Stadt.
create or replace view public.event_validation_issues as
select
  e.id,
  e.title,
  e.event_date,
  e.location,
  e.location_id,
  array_remove(array[
    case when nullif(trim(coalesce(e.title, '')), '') is null then 'Eventname fehlt' end,
    case when e.event_date is null then 'Datum fehlt' end,
    case when e.location_id is null then 'Stadt fehlt' end,
    case when e.location_id is not null and l.id is null then 'Stadt-ID ist ungültig' end
  ], null) as issues
from public.events e
left join public.locations l on l.id = e.location_id
where
  nullif(trim(coalesce(e.title, '')), '') is null
  or e.event_date is null
  or e.location_id is null
  or (e.location_id is not null and l.id is null);

-- 2) Schnellcheck im SQL Editor:
-- select * from public.event_validation_issues;

-- 3) Erst wenn der Schnellcheck leer ist, diese Constraints aktivieren.
--    Sonst blockt Postgres bestehende fehlerhafte Daten, völlig zurecht.

-- alter table public.events
--   alter column title set not null,
--   alter column event_date set not null,
--   alter column location_id set not null;

-- alter table public.events
--   add constraint events_title_not_blank check (length(trim(title)) > 0);

-- 4) Optional: alte Freitext-Orte später entfernen, wenn alle Events location_id haben.
-- alter table public.events drop column if exists location;
