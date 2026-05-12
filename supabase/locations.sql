-- Saubere Ortsbasis für Events: keine Freitext-Orte, später nutzbar für Karten/Umkreissuche.

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  state text,
  country_code text not null default 'DE',
  postal_code text,
  lat numeric(9,6),
  lng numeric(9,6),
  created_at timestamptz default now()
);

create index if not exists locations_postal_code_idx
on public.locations (postal_code);

alter table public.events
add column if not exists location_id uuid references public.locations(id);

alter table public.locations enable row level security;

drop policy if exists "locations readable" on public.locations;
create policy "locations readable"
on public.locations
for select
using (true);

insert into public.locations (name, slug, state, country_code, lat, lng) values
('Düsseldorf', 'duesseldorf', 'NRW', 'DE', 51.227700, 6.773500),
('Köln', 'koeln', 'NRW', 'DE', 50.937500, 6.960300),
('Duisburg', 'duisburg', 'NRW', 'DE', 51.434400, 6.762300),
('Essen', 'essen', 'NRW', 'DE', 51.455600, 7.011600),
('Dortmund', 'dortmund', 'NRW', 'DE', 51.513600, 7.465300),
('Moers', 'moers', 'NRW', 'DE', 51.451600, 6.640800),
('Kamp-Lintfort', 'kamp-lintfort', 'NRW', 'DE', 51.504700, 6.545800),
('Geldern', 'geldern', 'NRW', 'DE', 51.519100, 6.323600),
('Xanten', 'xanten', 'NRW', 'DE', 51.658800, 6.453000),
('Kevelaer', 'kevelaer', 'NRW', 'DE', 51.582400, 6.246900),
('Issum', 'issum', 'NRW', 'DE', 51.533300, 6.433300),
('Rheinberg', 'rheinberg', 'NRW', 'DE', 51.546900, 6.596700),
('Krefeld', 'krefeld', 'NRW', 'DE', 51.338800, 6.585300),
('Neukirchen-Vluyn', 'neukirchen-vluyn', 'NRW', 'DE', 51.445600, 6.549200),
('Wesel', 'wesel', 'NRW', 'DE', 51.666900, 6.620400),
('Oberhausen', 'oberhausen', 'NRW', 'DE', 51.496300, 6.863800),
('Mülheim an der Ruhr', 'muelheim-an-der-ruhr', 'NRW', 'DE', 51.418600, 6.884500),
('Bonn', 'bonn', 'NRW', 'DE', 50.737400, 7.098200),
('Münster', 'muenster', 'NRW', 'DE', 51.960700, 7.626100),
('Aachen', 'aachen', 'NRW', 'DE', 50.775300, 6.083900),
('Frankfurt am Main', 'frankfurt-am-main', 'Hessen', 'DE', 50.110900, 8.682100),
('München', 'muenchen', 'Bayern', 'DE', 48.135100, 11.582000),
('Hamburg', 'hamburg', 'Hamburg', 'DE', 53.551100, 9.993700),
('Berlin', 'berlin', 'Berlin', 'DE', 52.520000, 13.405000),
('Stuttgart', 'stuttgart', 'Baden-Württemberg', 'DE', 48.775800, 9.182900),
('Wien', 'wien', 'Wien', 'AT', 48.208200, 16.373800),
('Zürich', 'zuerich', 'Zürich', 'CH', 47.376900, 8.541700)
on conflict (slug) do update set
  name = excluded.name,
  state = excluded.state,
  country_code = excluded.country_code,
  lat = excluded.lat,
  lng = excluded.lng;
