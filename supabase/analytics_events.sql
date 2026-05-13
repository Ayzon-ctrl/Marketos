-- Analytics Events – Datenmodell, RLS und RPCs
--
-- Zweck: Sichere, serverseitige Erfassung von Nutzeraktionen im Dashboard.
--        Kein direkter Tabellenzugriff; alle Schreibvorgaenge laufen ueber
--        die SECURITY DEFINER-Funktion track_event().
--
-- Ausfuehren: Supabase SQL Editor → New query → Alles einfuegen → Run
-- Voraussetzung: schema.sql wurde bereits ausgefuehrt.

-- ---------------------------------------------------------------------------
-- Tabelle: analytics_events
-- ---------------------------------------------------------------------------

create table if not exists public.analytics_events (
  id            uuid        primary key default gen_random_uuid(),
  created_at    timestamptz not null    default now(),

  -- Wer hat die Aktion ausgefuehrt? NULL wenn Konto geloescht wird.
  user_id       uuid        references auth.users(id) on delete set null,

  -- Client-seitige Session-ID (crypto.randomUUID), kein persoenlicher Bezug.
  session_id    uuid,

  -- Kontext der Nutzerin zum Zeitpunkt der Aktion.
  role_context  text        check (role_context in ('organizer','exhibitor','visitor')),
  area          text        not null,
  event_name    text        not null,

  -- Optionaler Bezug zu einem konkreten Datensatz.
  entity_type   text,
  entity_id     uuid,

  -- Bereinigter Pfad ohne Query-Parameter (max. 500 Zeichen).
  route         text,

  -- Ergebnis der Aktion.
  result        text        check (result in ('success','error','cancelled')),

  -- Zusatzinfos; serverseitig auf erlaubte Schluessel begrenzt. Kein Freitext.
  metadata      jsonb       not null    default '{}'::jsonb,

  -- Umgebung, in der die Aktion stattfand.
  environment   text        not null    default 'production'
                            check (environment in ('production','development'))
);

-- Kein direkter Zugriff fuer niemanden – nur via SECURITY DEFINER RPCs.
alter table public.analytics_events enable row level security;

-- ---------------------------------------------------------------------------
-- RPC: track_event
--
-- Wird vom Client mit dem authed Supabase-Client aufgerufen.
-- Anon-Zugriff: kein EXECUTE-Recht (Grant) + auth.uid() IS NULL → return.
-- Unbekannte event_names: stille Rueckkehr, kein Fehler, kein INSERT.
-- Metadata: serverseitig auf Whitelist gekuerzt, kein Freitext moeglich.
-- Exceptions: werden abgefangen, kein Crash des Callers.
-- ---------------------------------------------------------------------------

create or replace function public.track_event(
  p_event_name   text,
  p_area         text,
  p_role_context text    default null,
  p_session_id   uuid    default null,
  p_entity_type  text    default null,
  p_entity_id    uuid    default null,
  p_route        text    default null,
  p_result       text    default null,
  p_metadata     jsonb   default '{}'::jsonb,
  p_environment  text    default 'production'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id       uuid;

  -- MVP-Event-Whitelist: nur explizit genannte Namen werden gespeichert.
  v_allowed_names text[] := array[
    'dashboard_loaded',
    'role_switched',
    'event_created',
    'event_saved',
    'event_published',
    'event_unpublished',
    'event_detail_opened',
    'import_dialog_opened',
    'import_completed',
    'participant_created',
    'participant_status_changed',
    'stand_option_created',
    'price_tier_created',
    'addon_option_created',
    'exhibitor_info_saved',
    'briefing_copied',
    'page_error',
    'api_error',
    'app_entry'
  ];

  -- Metadata-Whitelist: strukturierte Enum-artige Keys, kein Freitext.
  -- Bewusst nicht enthalten: label, reason, target, previous_status, new_status,
  -- email, name, ip, user_agent, referrer, message, description, stacktrace.
  v_allowed_keys  text[] := array[
    'count',
    'duration_ms',
    'selected_tab',
    'result',
    'error_code',
    'error_type',
    'feature_name',
    'import_basics',
    'import_exhibitor_info',
    'import_stand_pricing',
    'import_participants',
    'participant_count',
    'selected_participant_count',
    'skipped_count',
    'stand_option_count',
    'addon_count',
    'role_from',
    'role_to',
    'visibility_to',
    'had_existing_data',
    'route',
    'source'
  ];

  v_clean_route   text;
  v_clean_meta    jsonb;
begin
  -- Anon-Blocker: kein JWT → stille Rueckkehr, kein Fehler.
  -- Zweite Sicherungsebene hinter dem EXECUTE-Grant.
  v_user_id := auth.uid();
  if v_user_id is null then
    return;
  end if;

  -- Unbekannter event_name → stille Rueckkehr (Whitelist-Enforcement).
  -- Kein Fehler fuer den Client – Tracking soll nie crashen.
  if p_event_name is null or not (p_event_name = any(v_allowed_names)) then
    return;
  end if;

  -- Route bereinigen: Query-Parameter und Fragment entfernen, auf 500 Zeichen kuerzen.
  v_clean_route := split_part(split_part(coalesce(p_route, ''), '?', 1), '#', 1);
  if length(v_clean_route) > 500 then
    v_clean_route := left(v_clean_route, 500);
  end if;
  if v_clean_route = '' then
    v_clean_route := null;
  end if;

  -- Metadata auf erlaubte Schluessel filtern.
  -- Unbekannte Keys werden still gedroppt, kein Fehler.
  select coalesce(
    jsonb_object_agg(key, value),
    '{}'::jsonb
  )
  into v_clean_meta
  from jsonb_each(coalesce(p_metadata, '{}'::jsonb))
  where key = any(v_allowed_keys);

  -- Eintrag schreiben. Exception wird abgefangen – nie zum Caller weitergeben.
  begin
    insert into public.analytics_events (
      user_id,
      session_id,
      role_context,
      area,
      event_name,
      entity_type,
      entity_id,
      route,
      result,
      metadata,
      environment
    ) values (
      v_user_id,
      p_session_id,
      p_role_context,
      p_area,
      p_event_name,
      p_entity_type,
      p_entity_id,
      v_clean_route,
      p_result,
      v_clean_meta,
      coalesce(p_environment, 'production')
    );
  exception when others then
    -- Tracking-Fehler duerfen die Anwendung nie stoeren.
    return;
  end;
end;
$$;

-- Nur authentifizierte Nutzer duerfen track_event aufrufen.
-- anon bekommt kein EXECUTE-Recht.
revoke all on function public.track_event(text, text, text, uuid, text, uuid, text, text, jsonb, text) from public;
grant execute on function public.track_event(text, text, text, uuid, text, uuid, text, text, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: get_analytics_test_row
--
-- Hilfsfunktion fuer E2E-Tests: Liest eine eigene Zeile anhand der session_id.
-- Gibt nur Zeilen zurueck, die dem aufrufenden Nutzer gehoeren (user_id = auth.uid()).
-- Kein Admin-Report, kein Cross-User-Zugriff.
-- ---------------------------------------------------------------------------

create or replace function public.get_analytics_test_row(p_session_id uuid)
returns table (
  id            uuid,
  user_id       uuid,
  session_id    uuid,
  area          text,
  event_name    text,
  route         text,
  result        text,
  metadata      jsonb,
  environment   text,
  role_context  text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    e.id,
    e.user_id,
    e.session_id,
    e.area,
    e.event_name,
    e.route,
    e.result,
    e.metadata,
    e.environment,
    e.role_context
  from public.analytics_events e
  where e.session_id = p_session_id
    and e.user_id = auth.uid()
  limit 1;
end;
$$;

revoke all on function public.get_analytics_test_row(uuid) from public;
grant execute on function public.get_analytics_test_row(uuid) to authenticated;
