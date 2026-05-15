-- MarketOS: Schutz von profiles.is_admin gegen Self-Promotion
--
-- Problem:
--   Die bestehende RLS-Policy "profiles_update_own" erlaubt authenticated
--   Nutzern, ihre eigene Profilzeile in vollem Umfang zu aktualisieren.
--   Es gibt keinen Column-Level-Schutz fuer is_admin. Ohne diesen Trigger
--   koennte jeder User per Supabase-Client-Aufruf sich selbst zum Admin machen:
--     .update({ is_admin: true }).eq('id', ownUserId)
--
-- Loesung:
--   Ein BEFORE UPDATE-Trigger setzt new.is_admin = old.is_admin zurueck,
--   wenn ein normaler authenticated Client (auth.uid() IS NOT NULL) versucht,
--   den Wert zu aendern. Der Wert wird still ignoriert – kein Fehler wird
--   ausgeloest, sodass App-seitige Error-Handling nicht angepasst werden muss.
--
-- Ausnahme (SQL Editor / service_role):
--   Wenn der Trigger ueber den Supabase SQL Editor oder die service_role
--   ausgefuehrt wird, ist auth.uid() = NULL. In diesem Fall greift die Sperre
--   nicht und Admins koennen is_admin gezielt setzen:
--     UPDATE public.profiles SET is_admin = true WHERE id = '<user-uuid>';
--
-- Status: Manuell in Supabase ausgefuehrt vor Commit a5e02d3 (UX2.8.1 + UX2.8.5).
--         Trigger ist aktiv und verifiziert (RLS-Check v2, 2026-05-15).
--
-- Ausfuehren (bei Neuaufbau):
--   Supabase SQL Editor → New query → Inhalt einfuegen → Run
--   Reihenfolge: Nach supabase/admin_access.sql (is_admin-Spalte muss existieren)

-- ---------------------------------------------------------------------------
-- 1. Trigger-Funktion
-- ---------------------------------------------------------------------------

create or replace function public.protect_profile_admin_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Nur fuer authentifizierte Client-Requests (auth.uid() IS NOT NULL).
  -- SQL Editor und service_role liefern auth.uid() = NULL → Sperre greift nicht.
  if auth.uid() is not null then
    if new.is_admin is distinct from old.is_admin then
      new.is_admin := old.is_admin;
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Trigger
-- ---------------------------------------------------------------------------

drop trigger if exists protect_profile_admin_fields_trigger on public.profiles;

create trigger protect_profile_admin_fields_trigger
before update on public.profiles
for each row
execute function public.protect_profile_admin_fields();

-- ---------------------------------------------------------------------------
-- Rollback (bei Bedarf manuell ausfuehren, nicht Teil des normalen Ablaufs)
-- ---------------------------------------------------------------------------

-- drop trigger if exists protect_profile_admin_fields_trigger on public.profiles;
-- drop function if exists public.protect_profile_admin_fields();
