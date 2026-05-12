-- Fix recursive RLS on event_participants
-- Hintergrund: Die ursprüngliche participants_organizer_all-Policy führte zu einer
-- Endlosrekursion, wenn exhibitor_id IS NULL war:
--
--   INSERT event_participants → WITH CHECK → SELECT events
--   → events_participant_read → SELECT event_participants
--   → participants_organizer_all → SELECT events (ZIRKEL!)
--
-- Lösung: SECURITY DEFINER-Funktion für den Organizer-Check, die die
-- events-RLS-Kette umgeht und direkt den organizer_id prüft.
--
-- Ausfuehren: Supabase SQL Editor → New query → Alles einfuegen → Run
-- Voraussetzung: schema.sql wurde bereits ausgefuehrt.

-- ---------------------------------------------------------------------------
-- Hilfsfunktion: Prüft ob auth.uid() Organisator des Events ist.
-- SECURITY DEFINER umgeht RLS auf events, sodass kein Rekursions-Loop entsteht.
-- SET search_path verhindert search-path-Injection.
-- ---------------------------------------------------------------------------

create or replace function public.is_event_organizer(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.events e
    where e.id = p_event_id
      and e.organizer_id = auth.uid()
  );
$$;

-- Ausführungsrecht für authentifizierte und anonyme Rolle
revoke all on function public.is_event_organizer(uuid) from public;
grant execute on function public.is_event_organizer(uuid) to authenticated;
grant execute on function public.is_event_organizer(uuid) to anon;

-- ---------------------------------------------------------------------------
-- participants_organizer_all neu: verwendet is_event_organizer statt direkter
-- EXISTS-Subquery, um die Rekursion zu vermeiden.
-- ---------------------------------------------------------------------------

drop policy if exists "participants_organizer_all" on public.event_participants;
create policy "participants_organizer_all"
on public.event_participants
for all
using  (public.is_event_organizer(event_id))
with check (public.is_event_organizer(event_id));
