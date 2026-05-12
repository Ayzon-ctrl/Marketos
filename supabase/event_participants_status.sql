alter table public.event_participants
add column if not exists status text;

update public.event_participants
set status = case when paid then 'bestaetigt' else 'angefragt' end
where status is null;

alter table public.event_participants
alter column status set default 'angefragt';

alter table public.event_participants
alter column status set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'event_participants_status_check'
  ) then
    alter table public.event_participants
    add constraint event_participants_status_check
    check (status in ('angefragt', 'bestaetigt', 'warteliste', 'abgesagt'));
  end if;
end $$;
