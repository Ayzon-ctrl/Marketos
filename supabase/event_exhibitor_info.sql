create table if not exists public.event_exhibitor_info (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  setup_start_time time,
  setup_end_time time,
  teardown_start_time time,
  teardown_end_time time,
  arrival_notes text,
  access_notes text,
  exhibitor_contact_name text,
  exhibitor_contact_phone text,
  emergency_contact_name text,
  emergency_contact_phone text,
  power_notes text,
  parking_notes text,
  waste_notes text,
  exhibitor_general_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id)
);

create index if not exists event_exhibitor_info_event_id_idx
  on public.event_exhibitor_info (event_id);

alter table public.event_exhibitor_info enable row level security;

drop policy if exists "event_exhibitor_info_owner_select" on public.event_exhibitor_info;
create policy "event_exhibitor_info_owner_select"
on public.event_exhibitor_info
for select
using (
  exists (
    select 1
    from public.events e
    where e.id = event_exhibitor_info.event_id
      and e.organizer_id = auth.uid()
  )
);

drop policy if exists "event_exhibitor_info_owner_insert" on public.event_exhibitor_info;
create policy "event_exhibitor_info_owner_insert"
on public.event_exhibitor_info
for insert
with check (
  exists (
    select 1
    from public.events e
    where e.id = event_exhibitor_info.event_id
      and e.organizer_id = auth.uid()
  )
);

drop policy if exists "event_exhibitor_info_owner_update" on public.event_exhibitor_info;
create policy "event_exhibitor_info_owner_update"
on public.event_exhibitor_info
for update
using (
  exists (
    select 1
    from public.events e
    where e.id = event_exhibitor_info.event_id
      and e.organizer_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.events e
    where e.id = event_exhibitor_info.event_id
      and e.organizer_id = auth.uid()
  )
);

drop policy if exists "event_exhibitor_info_owner_delete" on public.event_exhibitor_info;
create policy "event_exhibitor_info_owner_delete"
on public.event_exhibitor_info
for delete
using (
  exists (
    select 1
    from public.events e
    where e.id = event_exhibitor_info.event_id
      and e.organizer_id = auth.uid()
  )
);

create or replace function public.set_event_exhibitor_info_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists event_exhibitor_info_set_updated_at on public.event_exhibitor_info;
create trigger event_exhibitor_info_set_updated_at
before update on public.event_exhibitor_info
for each row
execute function public.set_event_exhibitor_info_updated_at();
