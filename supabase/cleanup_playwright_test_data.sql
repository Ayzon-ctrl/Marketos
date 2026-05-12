-- MarketOS: Playwright-/E2E-Testdaten sicher bereinigen
-- =====================================================
-- Diese Datei löscht ausschließlich klar erkennbare Testdaten.
-- Echte Produktivdaten sollen unberührt bleiben.
--
-- Vorgehen:
-- 1. Vorschau-SELECTs prüfen
-- 2. Wenn die Treffer korrekt sind, die Datei komplett ausführen
--
-- Erkennungsmerkmale:
-- - vendor_profiles.business_name mit "Playwright" oder "PW_E2E_"
-- - events.title mit "Playwright", "PW_E2E_", "EVENT FLOW", "EVENT VALIDIERUNG"
-- - public_updates.title mit "Playwright" oder "PW_E2E_"
-- - Test-Mails aus tests/helpers/workflow.js:
--   - marketos-pw-%@example.com
--   - teilnehmer-%@example.com

begin;

drop table if exists tmp_pw_events;
drop table if exists tmp_pw_vendors;
drop table if exists tmp_pw_updates;
drop table if exists tmp_pw_participants;

create temporary table tmp_pw_events as
select id, organizer_id, title, event_date
from public.events
where coalesce(title, '') ilike 'PW_E2E_%'
   or coalesce(title, '') ilike '%Playwright%'
   or coalesce(title, '') ilike 'EVENT FLOW%'
   or coalesce(title, '') ilike 'EVENT VALIDIERUNG%';

create temporary table tmp_pw_vendors as
select id, owner_id, business_name, category, public_visible
from public.vendor_profiles
where coalesce(business_name, '') ilike 'PW_E2E_%'
   or coalesce(business_name, '') ilike '%Playwright%'
   or coalesce(description, '') ilike '%PW_E2E_%'
   or coalesce(description, '') ilike '%Playwright%'
   or coalesce(website_url, '') ilike 'https://example.com/vendor%';

create temporary table tmp_pw_updates as
select id, author_id, event_id, vendor_profile_id, title, created_at
from public.public_updates
where coalesce(title, '') ilike 'PW_E2E_%'
   or coalesce(title, '') ilike '%Playwright%'
   or event_id in (select id from tmp_pw_events)
   or vendor_profile_id in (select id from tmp_pw_vendors);

create temporary table tmp_pw_participants as
select id, event_id, exhibitor_id, exhibitor_name, email
from public.event_participants
where event_id in (select id from tmp_pw_events)
   or exhibitor_id in (select owner_id from tmp_pw_vendors)
   or coalesce(exhibitor_name, '') ilike 'PW_E2E_%'
   or coalesce(exhibitor_name, '') ilike '%Playwright%'
   or coalesce(email, '') ilike 'marketos-pw-%@example.com'
   or coalesce(email, '') ilike 'teilnehmer-%@example.com';

-- ============================================
-- Vorschau: Test-Events
-- ============================================
select * from tmp_pw_events order by event_date nulls last, title;

-- ============================================
-- Vorschau: Test-Händler
-- ============================================
select * from tmp_pw_vendors order by business_name;

-- ============================================
-- Vorschau: Test-Updates
-- ============================================
select * from tmp_pw_updates order by created_at desc nulls last;

-- ============================================
-- Vorschau: Test-Teilnehmer
-- ============================================
select * from tmp_pw_participants order by exhibitor_name, email;

-- ============================================
-- Vorschau: Test-Mails aus auth.users / profiles
-- ============================================
select id, email, created_at
from auth.users
where email ilike 'marketos-pw-%@example.com'
   or email ilike 'teilnehmer-%@example.com'
order by created_at desc;

select p.id, p.display_name, p.company_name, p.role, au.email
from public.profiles p
left join auth.users au on au.id = p.id
where au.email ilike 'marketos-pw-%@example.com'
   or au.email ilike 'teilnehmer-%@example.com'
   or coalesce(p.display_name, '') ilike 'PW_E2E_%'
   or coalesce(p.display_name, '') ilike '%Playwright%'
   or coalesce(p.company_name, '') ilike 'PW_E2E_%'
   or coalesce(p.company_name, '') ilike '%Playwright%'
order by au.email nulls last, p.company_name nulls last;

-- ============================================
-- DELETE 1: Notifications zu Test-Updates
-- ============================================
delete from public.notifications
where coalesce(title, '') ilike 'PW_E2E_%'
   or coalesce(title, '') ilike '%Playwright%'
   or coalesce(body, '') ilike '%PW_E2E_%'
   or coalesce(body, '') ilike '%Playwright%';

-- ============================================
-- DELETE 2: Public Updates zu Test-Events / Test-Händlern
-- ============================================
delete from public.public_updates
where id in (select id from tmp_pw_updates);

-- ============================================
-- DELETE 3: Event-Participants zu Test-Events / Test-Händlern
-- ============================================
delete from public.event_participants
where id in (select id from tmp_pw_participants);

-- ============================================
-- DELETE 4: Vendor Images zu Test-Händlern
-- ============================================
delete from public.vendor_images
where vendor_profile_id in (select id from tmp_pw_vendors);

-- ============================================
-- DELETE 5: Favorite-Event-Links zu Test-Events
-- ============================================
delete from public.visitor_favorite_events
where event_id in (select id from tmp_pw_events);

-- ============================================
-- DELETE 6: Favorite-Vendor-Links zu Test-Händlern
-- ============================================
delete from public.visitor_favorite_vendors
where vendor_profile_id in (select id from tmp_pw_vendors);

-- ============================================
-- DELETE 7: Reviews zu Test-Events
-- ============================================
delete from public.reviews
where event_id in (select id from tmp_pw_events);

-- ============================================
-- DELETE 8: Tasks zu Test-Events
-- ============================================
delete from public.tasks
where event_id in (select id from tmp_pw_events)
   or coalesce(title, '') ilike 'PW_E2E_%'
   or coalesce(title, '') ilike '%Playwright%';

-- ============================================
-- DELETE 9: Events mit Testtiteln
-- ============================================
delete from public.events
where id in (select id from tmp_pw_events);

-- ============================================
-- DELETE 10: Vendor Profiles mit Testnamen
-- ============================================
delete from public.vendor_profiles
where id in (select id from tmp_pw_vendors);

commit;
