-- F1.2: Standoptionen, Preisranges und Zusatzoptionen
-- Zweck: Datenmodell fuer Stand- und Preisoptionen pro Event.
-- Stand: F1.2 / organizer-only. Noch keine public-read-policy.
-- Ausfuehren: Supabase SQL Editor -> New query -> Alles einfuehren -> Run
-- Voraussetzung: schema.sql und public_product_core.sql wurden bereits ausgefuehrt.

-- ---------------------------------------------------------------------------
-- Generische updated_at-Triggerfunktion (idempotent, mehrfach nutzbar)
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tabelle: public.event_stand_options
-- Zweck: Standoptionen / Flaechenmodelle pro Event.
--        Jede Zeile beschreibt eine buchbare Standart (Typ, Untergrund, Preis).
-- ---------------------------------------------------------------------------

create table if not exists public.event_stand_options (
  id          uuid        primary key default gen_random_uuid(),
  event_id    uuid        not null references public.events(id) on delete cascade,

  -- Beschreibung
  label       text        not null,
  description text,

  -- Bereich / Standort
  area_type   text        not null
    check (area_type in (
      'indoor',
      'outdoor',
      'both',
      'covered',
      'partially_covered'
    )),

  -- Untergrund (Array, z.B. '{beton,asphalt}')
  surface_types text[]    not null default '{}',
  surface_notes text,

  -- Preislogik
  pricing_type text       not null
    check (pricing_type in (
      'flat',
      'fixed_size',
      'up_to_length',
      'per_meter',
      'per_sqm',
      'base_plus_extra',
      'tiered_length',
      'custom'
    )),

  -- Masse / Grenzen (je nach pricing_type benoetigt)
  width_m             numeric(6,2)  check (width_m             >= 0),
  depth_m             numeric(6,2)  check (depth_m             >= 0),
  min_length_m        numeric(6,2)  check (min_length_m        >= 0),
  max_length_m        numeric(6,2)  check (max_length_m        >= 0),
  included_length_m   numeric(6,2)  check (included_length_m   >= 0),
  max_depth_m         numeric(6,2)  check (max_depth_m         >= 0),

  -- Preisfelder (je nach pricing_type benoetigt)
  price_cents                 integer  check (price_cents                 >= 0),
  price_per_meter_cents       integer  check (price_per_meter_cents       >= 0),
  price_per_sqm_cents         integer  check (price_per_sqm_cents         >= 0),
  price_per_extra_meter_cents integer  check (price_per_extra_meter_cents >= 0),
  is_price_on_request         boolean  not null default false,
  pricing_description         text,

  -- Status und Sortierung
  is_available    boolean  not null default true,
  public_visible  boolean  not null default false,
  sort_order      integer  not null default 0 check (sort_order >= 0),

  -- Zeitstempel
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now()
);

-- Indexe
create index if not exists event_stand_options_event_id_idx
  on public.event_stand_options (event_id);

create index if not exists event_stand_options_event_id_sort_idx
  on public.event_stand_options (event_id, sort_order);

create index if not exists event_stand_options_event_id_available_idx
  on public.event_stand_options (event_id, is_available);

-- updated_at-Trigger
drop trigger if exists event_stand_options_set_updated_at on public.event_stand_options;
create trigger event_stand_options_set_updated_at
before update on public.event_stand_options
for each row
execute function public.set_updated_at();

-- RLS aktivieren
alter table public.event_stand_options enable row level security;

-- Organizer: Lesen
drop policy if exists "event_stand_options_owner_select" on public.event_stand_options;
create policy "event_stand_options_owner_select"
on public.event_stand_options
for select
using (
  exists (
    select 1
    from public.events e
    where e.id = event_stand_options.event_id
      and e.organizer_id = auth.uid()
  )
);

-- Organizer: Anlegen
drop policy if exists "event_stand_options_owner_insert" on public.event_stand_options;
create policy "event_stand_options_owner_insert"
on public.event_stand_options
for insert
with check (
  exists (
    select 1
    from public.events e
    where e.id = event_stand_options.event_id
      and e.organizer_id = auth.uid()
  )
);

-- Organizer: Bearbeiten
drop policy if exists "event_stand_options_owner_update" on public.event_stand_options;
create policy "event_stand_options_owner_update"
on public.event_stand_options
for update
using (
  exists (
    select 1
    from public.events e
    where e.id = event_stand_options.event_id
      and e.organizer_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.events e
    where e.id = event_stand_options.event_id
      and e.organizer_id = auth.uid()
  )
);

-- Organizer: Loeschen
drop policy if exists "event_stand_options_owner_delete" on public.event_stand_options;
create policy "event_stand_options_owner_delete"
on public.event_stand_options
for delete
using (
  exists (
    select 1
    from public.events e
    where e.id = event_stand_options.event_id
      and e.organizer_id = auth.uid()
  )
);

-- ---------------------------------------------------------------------------
-- Tabelle: public.event_stand_price_tiers
-- Zweck: Flexible Preisranges fuer Standoptionen.
--        Wird insbesondere bei pricing_type = 'tiered_length' benoetigt.
--        Ueberlappungspruefung erfolgt app-seitig, nicht per DB-Constraint.
-- ---------------------------------------------------------------------------

create table if not exists public.event_stand_price_tiers (
  id              uuid  primary key default gen_random_uuid(),
  stand_option_id uuid  not null references public.event_stand_options(id) on delete cascade,

  -- Anzeigelabel fuer diesen Preisbereich (z.B. "Bis 3 m Frontlaenge")
  label text,

  -- Laengengrenzen in Meter (null = offen)
  min_length_m  numeric(6,2)  check (min_length_m  >= 0),
  max_length_m  numeric(6,2)  check (max_length_m  >= 0),

  -- Tiefengrenzen in Meter (null = keine Einschraenkung)
  min_depth_m   numeric(6,2)  check (min_depth_m   >= 0),
  max_depth_m   numeric(6,2)  check (max_depth_m   >= 0),

  -- Flaechengrenzen in m2 (null = keine Einschraenkung)
  min_area_sqm  numeric(8,2)  check (min_area_sqm  >= 0),
  max_area_sqm  numeric(8,2)  check (max_area_sqm  >= 0),

  -- Preisfelder fuer diesen Tier
  price_cents                 integer  check (price_cents                 >= 0),
  price_per_meter_cents       integer  check (price_per_meter_cents       >= 0),
  price_per_sqm_cents         integer  check (price_per_sqm_cents         >= 0),
  price_per_extra_meter_cents integer  check (price_per_extra_meter_cents >= 0),
  is_price_on_request         boolean  not null default false,

  -- Reihenfolge (bestimmt Matching-Prioritaet bei Ueberlappung)
  sort_order  integer  not null default 0 check (sort_order >= 0),

  -- Zeitstempel
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now()
);

-- Indexe
create index if not exists event_stand_price_tiers_stand_option_id_idx
  on public.event_stand_price_tiers (stand_option_id);

create index if not exists event_stand_price_tiers_stand_option_sort_idx
  on public.event_stand_price_tiers (stand_option_id, sort_order);

-- updated_at-Trigger
drop trigger if exists event_stand_price_tiers_set_updated_at on public.event_stand_price_tiers;
create trigger event_stand_price_tiers_set_updated_at
before update on public.event_stand_price_tiers
for each row
execute function public.set_updated_at();

-- RLS aktivieren
alter table public.event_stand_price_tiers enable row level security;

-- Organizer: Lesen (Join ueber event_stand_options -> events)
drop policy if exists "event_stand_price_tiers_owner_select" on public.event_stand_price_tiers;
create policy "event_stand_price_tiers_owner_select"
on public.event_stand_price_tiers
for select
using (
  exists (
    select 1
    from public.event_stand_options eso
    join public.events e on e.id = eso.event_id
    where eso.id = event_stand_price_tiers.stand_option_id
      and e.organizer_id = auth.uid()
  )
);

-- Organizer: Anlegen
drop policy if exists "event_stand_price_tiers_owner_insert" on public.event_stand_price_tiers;
create policy "event_stand_price_tiers_owner_insert"
on public.event_stand_price_tiers
for insert
with check (
  exists (
    select 1
    from public.event_stand_options eso
    join public.events e on e.id = eso.event_id
    where eso.id = event_stand_price_tiers.stand_option_id
      and e.organizer_id = auth.uid()
  )
);

-- Organizer: Bearbeiten
drop policy if exists "event_stand_price_tiers_owner_update" on public.event_stand_price_tiers;
create policy "event_stand_price_tiers_owner_update"
on public.event_stand_price_tiers
for update
using (
  exists (
    select 1
    from public.event_stand_options eso
    join public.events e on e.id = eso.event_id
    where eso.id = event_stand_price_tiers.stand_option_id
      and e.organizer_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.event_stand_options eso
    join public.events e on e.id = eso.event_id
    where eso.id = event_stand_price_tiers.stand_option_id
      and e.organizer_id = auth.uid()
  )
);

-- Organizer: Loeschen
drop policy if exists "event_stand_price_tiers_owner_delete" on public.event_stand_price_tiers;
create policy "event_stand_price_tiers_owner_delete"
on public.event_stand_price_tiers
for delete
using (
  exists (
    select 1
    from public.event_stand_options eso
    join public.events e on e.id = eso.event_id
    where eso.id = event_stand_price_tiers.stand_option_id
      and e.organizer_id = auth.uid()
  )
);

-- ---------------------------------------------------------------------------
-- Tabelle: public.event_addon_options
-- Zweck: Zusatzoptionen pro Event (z.B. Strom, Wasser, Tisch, Pavillon).
-- ---------------------------------------------------------------------------

create table if not exists public.event_addon_options (
  id        uuid  primary key default gen_random_uuid(),
  event_id  uuid  not null references public.events(id) on delete cascade,

  -- Art der Zusatzoption
  addon_type text  not null
    check (addon_type in (
      'electricity',
      'water',
      'table',
      'chair',
      'pavilion',
      'waste_fee',
      'cleaning_fee',
      'parking_fee',
      'deposit',
      'other'
    )),

  -- Bezeichnung und Beschreibung
  label       text  not null,
  description text,

  -- Preis
  price_cents         integer  check (price_cents >= 0),
  is_price_on_request boolean  not null default false,

  -- Status und Sortierung
  is_available    boolean  not null default true,
  public_visible  boolean  not null default false,
  sort_order      integer  not null default 0 check (sort_order >= 0),

  -- Zeitstempel
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now()
);

-- Indexe
create index if not exists event_addon_options_event_id_idx
  on public.event_addon_options (event_id);

create index if not exists event_addon_options_event_id_sort_idx
  on public.event_addon_options (event_id, sort_order);

create index if not exists event_addon_options_event_id_available_idx
  on public.event_addon_options (event_id, is_available);

-- updated_at-Trigger
drop trigger if exists event_addon_options_set_updated_at on public.event_addon_options;
create trigger event_addon_options_set_updated_at
before update on public.event_addon_options
for each row
execute function public.set_updated_at();

-- RLS aktivieren
alter table public.event_addon_options enable row level security;

-- Organizer: Lesen
drop policy if exists "event_addon_options_owner_select" on public.event_addon_options;
create policy "event_addon_options_owner_select"
on public.event_addon_options
for select
using (
  exists (
    select 1
    from public.events e
    where e.id = event_addon_options.event_id
      and e.organizer_id = auth.uid()
  )
);

-- Organizer: Anlegen
drop policy if exists "event_addon_options_owner_insert" on public.event_addon_options;
create policy "event_addon_options_owner_insert"
on public.event_addon_options
for insert
with check (
  exists (
    select 1
    from public.events e
    where e.id = event_addon_options.event_id
      and e.organizer_id = auth.uid()
  )
);

-- Organizer: Bearbeiten
drop policy if exists "event_addon_options_owner_update" on public.event_addon_options;
create policy "event_addon_options_owner_update"
on public.event_addon_options
for update
using (
  exists (
    select 1
    from public.events e
    where e.id = event_addon_options.event_id
      and e.organizer_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.events e
    where e.id = event_addon_options.event_id
      and e.organizer_id = auth.uid()
  )
);

-- Organizer: Loeschen
drop policy if exists "event_addon_options_owner_delete" on public.event_addon_options;
create policy "event_addon_options_owner_delete"
on public.event_addon_options
for delete
using (
  exists (
    select 1
    from public.events e
    where e.id = event_addon_options.event_id
      and e.organizer_id = auth.uid()
  )
);
