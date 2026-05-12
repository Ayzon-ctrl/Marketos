-- MarketOS: sichere Bereinigung von Playwright-/E2E-Testdaten
-- -----------------------------------------------------------
-- Diese Datei ist für den Supabase SQL Editor gedacht.
-- Sie löscht nur klar erkennbare Testdaten und lässt echte Produktivdaten stehen.
--
-- Erkennungsregeln:
-- - Eventtitel mit "Playwright", "EVENT FLOW", "EVENT VALIDIERUNG", "E2E"
-- - bewusst generische Testtitel mit "Test", aber NICHT "Wettbewerb"
-- - Test-User aus workflow.js mit *@example.com
-- - Test-Händlerprofile mit "Playwright ..." oder example.com-Website
--
-- Ablauf:
-- 1. Vorschau ansehen
-- 2. Wenn die Treffer korrekt sind, die Datei komplett ausführen

begin;

-- ============================================
-- Vorschau: betroffene Test-Accounts / Profile
-- ============================================
with candidate_auth_users as (
  select id, email, created_at
  from auth.users
  where email ilike 'marketos-pw-%@example.com'
     or email ilike 'teilnehmer-%@example.com'
),
candidate_profiles as (
  select
    p.id,
    p.display_name,
    p.company_name,
    p.role,
    au.email
  from public.profiles p
  left join auth.users au on au.id = p.id
  where au.email ilike 'marketos-pw-%@example.com'
     or au.email ilike 'teilnehmer-%@example.com'
     or coalesce(p.display_name, '') ilike 'Playwright %'
     or coalesce(p.company_name, '') ilike 'Playwright %'
     or coalesce(p.company_name, '') = 'Playwright QA'
)
select 'auth.users' as source, email as identifier, created_at
from candidate_auth_users
union all
select 'profiles' as source, coalesce(email, display_name, company_name, id::text) as identifier, null::timestamptz
from candidate_profiles
order by source, identifier;

-- ============================================
-- Vorschau: betroffene Test-Events
-- ============================================
with candidate_events as (
  select id, title, event_date, organizer_id
  from public.events
  where coalesce(title, '') ilike '%Playwright%'
     or coalesce(title, '') ilike '%EVENT FLOW%'
     or coalesce(title, '') ilike '%EVENT VALIDIERUNG%'
     or coalesce(title, '') ilike '%E2E%'
     or (
       coalesce(title, '') ilike '%Test%'
       and coalesce(title, '') not ilike '%Wettbewerb%'
     )
)
select id, title, event_date, organizer_id
from candidate_events
order by event_date nulls last, title;

-- ============================================
-- Vorschau: betroffene Test-Händlerprofile
-- ============================================
with candidate_vendor_profiles as (
  select id, owner_id, business_name, category, public_visible
  from public.vendor_profiles
  where coalesce(business_name, '') ilike 'Playwright %'
     or coalesce(description, '') ilike '%Playwright%'
     or coalesce(website_url, '') ilike 'https://example.com/vendor%'
)
select *
from candidate_vendor_profiles
order by business_name;

-- ============================================
-- Vorschau: Kernzähler
-- ============================================
with candidate_profile_ids as (
  select p.id
  from public.profiles p
  left join auth.users au on au.id = p.id
  where au.email ilike 'marketos-pw-%@example.com'
     or au.email ilike 'teilnehmer-%@example.com'
     or coalesce(p.display_name, '') ilike 'Playwright %'
     or coalesce(p.company_name, '') ilike 'Playwright %'
     or coalesce(p.company_name, '') = 'Playwright QA'
),
candidate_event_ids as (
  select id
  from public.events
  where coalesce(title, '') ilike '%Playwright%'
     or coalesce(title, '') ilike '%EVENT FLOW%'
     or coalesce(title, '') ilike '%EVENT VALIDIERUNG%'
     or coalesce(title, '') ilike '%E2E%'
     or (
       coalesce(title, '') ilike '%Test%'
       and coalesce(title, '') not ilike '%Wettbewerb%'
     )
),
candidate_vendor_ids as (
  select id
  from public.vendor_profiles
  where coalesce(business_name, '') ilike 'Playwright %'
     or coalesce(description, '') ilike '%Playwright%'
     or coalesce(website_url, '') ilike 'https://example.com/vendor%'
),
counts as (
  select 'notifications' as table_name, count(*)::bigint as rows
  from public.notifications
  where user_id in (select id from candidate_profile_ids)
  union all
  select 'public_updates', count(*)::bigint
  from public.public_updates
  where author_id in (select id from candidate_profile_ids)
     or event_id in (select id from candidate_event_ids)
     or vendor_profile_id in (select id from candidate_vendor_ids)
  union all
  select 'event_participants', count(*)::bigint
  from public.event_participants
  where event_id in (select id from candidate_event_ids)
     or exhibitor_id in (select id from candidate_profile_ids)
     or coalesce(exhibitor_name, '') ilike 'Playwright %'
     or coalesce(email, '') ilike 'marketos-pw-%@example.com'
     or coalesce(email, '') ilike 'teilnehmer-%@example.com'
  union all
  select 'tasks', count(*)::bigint
  from public.tasks
  where owner_id in (select id from candidate_profile_ids)
     or event_id in (select id from candidate_event_ids)
     or coalesce(title, '') ilike '%Playwright%'
  union all
  select 'reviews', count(*)::bigint
  from public.reviews
  where event_id in (select id from candidate_event_ids)
     or profile_id in (select id from candidate_profile_ids)
     or author_id in (select id from candidate_profile_ids)
  union all
  select 'vendor_images', count(*)::bigint
  from public.vendor_images
  where vendor_profile_id in (select id from candidate_vendor_ids)
  union all
  select 'vendor_profiles', count(*)::bigint
  from public.vendor_profiles
  where id in (select id from candidate_vendor_ids)
  union all
  select 'events', count(*)::bigint
  from public.events
  where id in (select id from candidate_event_ids)
  union all
  select 'profiles', count(*)::bigint
  from public.profiles
  where id in (select id from candidate_profile_ids)
  union all
  select 'auth.users', count(*)::bigint
  from auth.users
  where email ilike 'marketos-pw-%@example.com'
     or email ilike 'teilnehmer-%@example.com'
)
select *
from counts
where rows > 0
order by table_name;

-- ============================================
-- DELETE: Kern-Tabellen
-- ============================================
with candidate_profile_ids as (
  select p.id
  from public.profiles p
  left join auth.users au on au.id = p.id
  where au.email ilike 'marketos-pw-%@example.com'
     or au.email ilike 'teilnehmer-%@example.com'
     or coalesce(p.display_name, '') ilike 'Playwright %'
     or coalesce(p.company_name, '') ilike 'Playwright %'
     or coalesce(p.company_name, '') = 'Playwright QA'
)
delete from public.notifications
where user_id in (select id from candidate_profile_ids);

with candidate_profile_ids as (
  select p.id
  from public.profiles p
  left join auth.users au on au.id = p.id
  where au.email ilike 'marketos-pw-%@example.com'
     or au.email ilike 'teilnehmer-%@example.com'
     or coalesce(p.display_name, '') ilike 'Playwright %'
     or coalesce(p.company_name, '') ilike 'Playwright %'
     or coalesce(p.company_name, '') = 'Playwright QA'
),
candidate_event_ids as (
  select id
  from public.events
  where coalesce(title, '') ilike '%Playwright%'
     or coalesce(title, '') ilike '%EVENT FLOW%'
     or coalesce(title, '') ilike '%EVENT VALIDIERUNG%'
     or coalesce(title, '') ilike '%E2E%'
     or (
       coalesce(title, '') ilike '%Test%'
       and coalesce(title, '') not ilike '%Wettbewerb%'
     )
),
candidate_vendor_ids as (
  select id
  from public.vendor_profiles
  where coalesce(business_name, '') ilike 'Playwright %'
     or coalesce(description, '') ilike '%Playwright%'
     or coalesce(website_url, '') ilike 'https://example.com/vendor%'
)
delete from public.public_updates
where author_id in (select id from candidate_profile_ids)
   or event_id in (select id from candidate_event_ids)
   or vendor_profile_id in (select id from candidate_vendor_ids);

with candidate_profile_ids as (
  select p.id
  from public.profiles p
  left join auth.users au on au.id = p.id
  where au.email ilike 'marketos-pw-%@example.com'
     or au.email ilike 'teilnehmer-%@example.com'
     or coalesce(p.display_name, '') ilike 'Playwright %'
     or coalesce(p.company_name, '') ilike 'Playwright %'
     or coalesce(p.company_name, '') = 'Playwright QA'
),
candidate_event_ids as (
  select id
  from public.events
  where coalesce(title, '') ilike '%Playwright%'
     or coalesce(title, '') ilike '%EVENT FLOW%'
     or coalesce(title, '') ilike '%EVENT VALIDIERUNG%'
     or coalesce(title, '') ilike '%E2E%'
     or (
       coalesce(title, '') ilike '%Test%'
       and coalesce(title, '') not ilike '%Wettbewerb%'
     )
)
delete from public.event_participants
where event_id in (select id from candidate_event_ids)
   or exhibitor_id in (select id from candidate_profile_ids)
   or coalesce(exhibitor_name, '') ilike 'Playwright %'
   or coalesce(email, '') ilike 'marketos-pw-%@example.com'
   or coalesce(email, '') ilike 'teilnehmer-%@example.com';

with candidate_profile_ids as (
  select p.id
  from public.profiles p
  left join auth.users au on au.id = p.id
  where au.email ilike 'marketos-pw-%@example.com'
     or au.email ilike 'teilnehmer-%@example.com'
     or coalesce(p.display_name, '') ilike 'Playwright %'
     or coalesce(p.company_name, '') ilike 'Playwright %'
     or coalesce(p.company_name, '') = 'Playwright QA'
),
candidate_event_ids as (
  select id
  from public.events
  where coalesce(title, '') ilike '%Playwright%'
     or coalesce(title, '') ilike '%EVENT FLOW%'
     or coalesce(title, '') ilike '%EVENT VALIDIERUNG%'
     or coalesce(title, '') ilike '%E2E%'
     or (
       coalesce(title, '') ilike '%Test%'
       and coalesce(title, '') not ilike '%Wettbewerb%'
     )
)
delete from public.tasks
where owner_id in (select id from candidate_profile_ids)
   or event_id in (select id from candidate_event_ids)
   or coalesce(title, '') ilike '%Playwright%';

with candidate_profile_ids as (
  select p.id
  from public.profiles p
  left join auth.users au on au.id = p.id
  where au.email ilike 'marketos-pw-%@example.com'
     or au.email ilike 'teilnehmer-%@example.com'
     or coalesce(p.display_name, '') ilike 'Playwright %'
     or coalesce(p.company_name, '') ilike 'Playwright %'
     or coalesce(p.company_name, '') = 'Playwright QA'
),
candidate_event_ids as (
  select id
  from public.events
  where coalesce(title, '') ilike '%Playwright%'
     or coalesce(title, '') ilike '%EVENT FLOW%'
     or coalesce(title, '') ilike '%EVENT VALIDIERUNG%'
     or coalesce(title, '') ilike '%E2E%'
     or (
       coalesce(title, '') ilike '%Test%'
       and coalesce(title, '') not ilike '%Wettbewerb%'
     )
)
delete from public.reviews
where event_id in (select id from candidate_event_ids)
   or profile_id in (select id from candidate_profile_ids)
   or author_id in (select id from candidate_profile_ids);

-- Optionale Tabellen: vor dem Entfernen der Basisdatensätze leeren
do $$
begin
  if to_regclass('public.list_items') is not null and to_regclass('public.lists') is not null then
    execute $sql$
      with candidate_profile_ids as (
        select p.id
        from public.profiles p
        left join auth.users au on au.id = p.id
        where au.email ilike 'marketos-pw-%@example.com'
           or au.email ilike 'teilnehmer-%@example.com'
           or coalesce(p.display_name, '') ilike 'Playwright %'
           or coalesce(p.company_name, '') ilike 'Playwright %'
           or coalesce(p.company_name, '') = 'Playwright QA'
      ),
      candidate_event_ids as (
        select id
        from public.events
        where coalesce(title, '') ilike '%Playwright%'
           or coalesce(title, '') ilike '%EVENT FLOW%'
           or coalesce(title, '') ilike '%EVENT VALIDIERUNG%'
           or coalesce(title, '') ilike '%E2E%'
           or (
             coalesce(title, '') ilike '%Test%'
             and coalesce(title, '') not ilike '%Wettbewerb%'
           )
      ),
      candidate_list_ids as (
        select id
        from public.lists
        where owner_id in (select id from candidate_profile_ids)
           or event_id in (select id from candidate_event_ids)
           or coalesce(title, '') ilike '%Playwright%'
      )
      delete from public.list_items
      where list_id in (select id from candidate_list_ids)
    $sql$;

    execute $sql$
      with candidate_profile_ids as (
        select p.id
        from public.profiles p
        left join auth.users au on au.id = p.id
        where au.email ilike 'marketos-pw-%@example.com'
           or au.email ilike 'teilnehmer-%@example.com'
           or coalesce(p.display_name, '') ilike 'Playwright %'
           or coalesce(p.company_name, '') ilike 'Playwright %'
           or coalesce(p.company_name, '') = 'Playwright QA'
      ),
      candidate_event_ids as (
        select id
        from public.events
        where coalesce(title, '') ilike '%Playwright%'
           or coalesce(title, '') ilike '%EVENT FLOW%'
           or coalesce(title, '') ilike '%EVENT VALIDIERUNG%'
           or coalesce(title, '') ilike '%E2E%'
           or (
             coalesce(title, '') ilike '%Test%'
             and coalesce(title, '') not ilike '%Wettbewerb%'
           )
      )
      delete from public.lists
      where owner_id in (select id from candidate_profile_ids)
         or event_id in (select id from candidate_event_ids)
         or coalesce(title, '') ilike '%Playwright%'
    $sql$;
  end if;

  if to_regclass('public.subscriptions') is not null then
    execute $sql$
      delete from public.subscriptions
      where profile_id in (
        select p.id
        from public.profiles p
        left join auth.users au on au.id = p.id
        where au.email ilike 'marketos-pw-%@example.com'
           or au.email ilike 'teilnehmer-%@example.com'
           or coalesce(p.display_name, '') ilike 'Playwright %'
           or coalesce(p.company_name, '') ilike 'Playwright %'
           or coalesce(p.company_name, '') = 'Playwright QA'
      )
    $sql$;
  end if;

  if to_regclass('public.billing_events') is not null then
    execute $sql$
      delete from public.billing_events
      where profile_id in (
        select p.id
        from public.profiles p
        left join auth.users au on au.id = p.id
        where au.email ilike 'marketos-pw-%@example.com'
           or au.email ilike 'teilnehmer-%@example.com'
           or coalesce(p.display_name, '') ilike 'Playwright %'
           or coalesce(p.company_name, '') ilike 'Playwright %'
           or coalesce(p.company_name, '') = 'Playwright QA'
      )
    $sql$;
  end if;
end $$;

with candidate_vendor_ids as (
  select id
  from public.vendor_profiles
  where coalesce(business_name, '') ilike 'Playwright %'
     or coalesce(description, '') ilike '%Playwright%'
     or coalesce(website_url, '') ilike 'https://example.com/vendor%'
)
delete from public.vendor_images
where vendor_profile_id in (select id from candidate_vendor_ids);

with candidate_event_ids as (
  select id
  from public.events
  where coalesce(title, '') ilike '%Playwright%'
     or coalesce(title, '') ilike '%EVENT FLOW%'
     or coalesce(title, '') ilike '%EVENT VALIDIERUNG%'
     or coalesce(title, '') ilike '%E2E%'
     or (
       coalesce(title, '') ilike '%Test%'
       and coalesce(title, '') not ilike '%Wettbewerb%'
     )
)
delete from public.events
where id in (select id from candidate_event_ids);

with candidate_vendor_ids as (
  select id
  from public.vendor_profiles
  where coalesce(business_name, '') ilike 'Playwright %'
     or coalesce(description, '') ilike '%Playwright%'
     or coalesce(website_url, '') ilike 'https://example.com/vendor%'
)
delete from public.vendor_profiles
where id in (select id from candidate_vendor_ids);

with candidate_profile_ids as (
  select p.id
  from public.profiles p
  left join auth.users au on au.id = p.id
  where au.email ilike 'marketos-pw-%@example.com'
     or au.email ilike 'teilnehmer-%@example.com'
     or coalesce(p.display_name, '') ilike 'Playwright %'
     or coalesce(p.company_name, '') ilike 'Playwright %'
     or coalesce(p.company_name, '') = 'Playwright QA'
)
delete from public.profiles
where id in (select id from candidate_profile_ids);

delete from auth.users
where email ilike 'marketos-pw-%@example.com'
   or email ilike 'teilnehmer-%@example.com';

commit;
