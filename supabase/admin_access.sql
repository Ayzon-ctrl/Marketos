-- Admin-Zugriff fuer MarketOS – Betreiber-Adminrechte
--
-- Zweck: Fuegt der profiles-Tabelle eine is_admin-Spalte hinzu und
--        stellt eine sichere SECURITY DEFINER-Hilfsfunktion bereit,
--        die als Gate fuer admin-only-Features (z.B. Analytics-RPC) dient.
--
-- Ausfuehren: Supabase SQL Editor → New query → Alles einfuegen → Run
-- Reihenfolge: Nach supabase/analytics_summary.sql ausfuehren.
--
-- Sicherheitshinweis:
--   Die bestehende RLS-Update-Policy auf profiles erlaubt Nutzern,
--   is_admin auf ihrem eigenen Profil zu setzen (weil kein Column-Level-
--   Schutz existiert). Dies ist fuer den aktuellen Einsatzbereich (internes
--   Aggregate-Dashboard ohne PII) akzeptabel. Fuer eine haertere Absicherung
--   wuerde man einen BEFORE UPDATE-Trigger einsetzen, der Nicht-Admins das
--   Aendern von is_admin verwehrt.

-- ---------------------------------------------------------------------------
-- 1. is_admin-Spalte zu profiles hinzufuegen
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- ---------------------------------------------------------------------------
-- 2. Hilfsfunktion is_app_admin()
--
-- Gibt true zurueck wenn der aktuell eingeloggte Nutzer (auth.uid())
-- in der profiles-Tabelle als Admin markiert ist (is_admin = true).
-- Gibt false zurueck fuer anon und alle Nicht-Admin-Nutzer.
--
-- Wird aus get_analytics_summary() und weiteren kuenftigen Admin-RPCs
-- aufgerufen.
--
-- Sicherheit:
--   - SECURITY DEFINER: liest profiles trotz restriktiver RLS.
--   - SET search_path = public: verhindert Search-Path-Injection.
--   - auth.uid() IS NULL → sofort false (kein DB-Zugriff fuer anon).
-- ---------------------------------------------------------------------------

create or replace function public.is_app_admin()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean;
begin
  -- Anon-Blocker: Ohne JWT kein Admin.
  if auth.uid() is null then
    return false;
  end if;

  select coalesce(p.is_admin, false)
    into v_is_admin
    from public.profiles p
   where p.id = auth.uid();

  return coalesce(v_is_admin, false);
end;
$$;

-- Nur authentifizierte Nutzer duerfen is_app_admin aufrufen.
revoke all   on function public.is_app_admin() from public;
grant execute on function public.is_app_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Edwin als Admin setzen
--
-- profiles hat KEINE email-Spalte. Die E-Mail liegt in auth.users.
-- Daher JOIN beider Tabellen, um Edwins UUID zu ermitteln.
--
-- Schritt 1 – UUID und aktuellen Status pruefen:
--   select p.id, u.email, p.role, p.is_admin
--   from public.profiles p
--   join auth.users u on u.id = p.id
--   where u.email = '<EDWINS_EMAIL>';
--
-- Schritt 2 – Admin setzen (UUID aus Schritt 1 einsetzen):
--   update public.profiles
--   set is_admin = true
--   where id = '<EDWINS_USER_ID>';
--
-- Diese beiden Abfragen sind NICHT Teil dieses Skripts und werden
-- SEPARAT im Supabase SQL Editor ausgefuehrt, nachdem Edwin die UUID
-- geprueft hat.
-- ---------------------------------------------------------------------------
