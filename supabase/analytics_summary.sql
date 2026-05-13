-- Analytics Summary – Sichere Aggregations-RPC fuer das interne Analytics-Dashboard
--
-- Zweck: Aggregierte Nutzungsstatistiken fuer den Betreiber.
--        Kein direkter Tabellenzugriff; user_id / session_id / entity_id
--        erscheinen NIE in der Ausgabe – nur COUNT-Werte.
--        Anon-Zugriff ist zweifach blockiert:
--          1. Kein EXECUTE-Grant fuer anon
--          2. auth.uid() IS NULL → stille Rueckkehr
--        Zeitraum ist serverseitig auf 1–365 Tage gecappt.
--
-- Ausfuehren: Supabase SQL Editor → New query → Alles einfuegen → Run
-- Voraussetzung: supabase/analytics_events.sql wurde bereits ausgefuehrt.

-- ---------------------------------------------------------------------------
-- RPC: get_analytics_summary
--
-- Gibt aggregierte Ereigniszaehler zurueck, gruppiert nach Tag, Bereich,
-- Rollenkontext, Event-Name und Umgebung.
--
-- Parameter:
--   p_days         Zeitraum in Tagen rueckwaerts ab jetzt (Standard: 30, Cap: 1–365).
--   p_area         Optionaler Filter auf einen Bereich (z.B. 'events', 'dashboard').
--   p_role_context Optionaler Filter auf einen Rollenkontext ('organizer' etc.).
--   p_environment  Umgebung – Standard 'production', alternativ 'development'.
--
-- Ausgabe:
--   day            Datum des Ereignisses (ohne Uhrzeit).
--   area           Bereich der Anwendung.
--   role_context   Rolle zum Zeitpunkt des Ereignisses (kann NULL sein).
--   event_name     Name des Ereignisses.
--   event_count    Anzahl der Ereignisse fuer diese Kombination an diesem Tag.
--   environment    Umgebung ('production' | 'development').
--
-- Sicherheit:
--   - SECURITY DEFINER: liest analytics_events trotz RLS ohne SELECT-Policy.
--   - SET search_path = public: verhindert Search-Path-Injection.
--   - Keine user_id / session_id / entity_id in der Ausgabe.
--   - Nur authentifizierte Nutzer duerfen die Funktion aufrufen.
-- ---------------------------------------------------------------------------

create or replace function public.get_analytics_summary(
  p_days         integer default 30,
  p_area         text    default null,
  p_role_context text    default null,
  p_environment  text    default 'production'
)
returns table (
  day            date,
  area           text,
  role_context   text,
  event_name     text,
  event_count    bigint,
  environment    text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_days integer;
begin
  -- Anon-Blocker: kein JWT → stille Rueckkehr, leere Ergebnismenge.
  -- Zweite Sicherungsebene hinter dem EXECUTE-Grant.
  if auth.uid() is null then
    return;
  end if;

  -- Admin-Gate: Nur Betreiber-Admins (profiles.is_admin = true) duerfen
  -- aggregierte Nutzungsstatistiken abrufen. Nicht-Admins erhalten eine
  -- leere Ergebnismenge (kein Fehler, kein Datenleck).
  if not public.is_app_admin() then
    return;
  end if;

  -- Zeitraum-Cap: mindestens 1 Tag, hoechstens 365 Tage.
  -- Negative Werte und NULL werden auf 1 gesetzt; Werte > 365 werden gekappt.
  v_days := greatest(1, least(coalesce(p_days, 30), 365));

  return query
  select
    date(e.created_at)                  as day,
    e.area,
    e.role_context,
    e.event_name,
    count(*)::bigint                    as event_count,
    e.environment
  from public.analytics_events e
  where
    e.created_at >= now() - (v_days || ' days')::interval
    and (p_area         is null or e.area         = p_area)
    and (p_role_context is null or e.role_context = p_role_context)
    and e.environment = coalesce(p_environment, 'production')
  group by
    date(e.created_at),
    e.area,
    e.role_context,
    e.event_name,
    e.environment
  order by
    day desc,
    event_count desc;
end;
$$;

-- Nur authentifizierte Nutzer duerfen get_analytics_summary aufrufen.
-- anon bekommt kein EXECUTE-Recht.
revoke all   on function public.get_analytics_summary(integer, text, text, text) from public;
grant execute on function public.get_analytics_summary(integer, text, text, text) to authenticated;
