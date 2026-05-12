begin;

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  promotion_type text not null,
  target_type text not null,
  event_id uuid null references public.events(id) on delete cascade,
  vendor_profile_id uuid null references public.vendor_profiles(id) on delete cascade,
  title text null,
  description text null,
  starts_at timestamptz null,
  ends_at timestamptz null,
  status text not null default 'draft',
  payment_status text not null default 'unpaid',
  provider text null,
  provider_checkout_id text null,
  provider_payment_id text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.promotions add column if not exists owner_id uuid;
alter table public.promotions add column if not exists promotion_type text;
alter table public.promotions add column if not exists target_type text;
alter table public.promotions add column if not exists event_id uuid;
alter table public.promotions add column if not exists vendor_profile_id uuid;
alter table public.promotions add column if not exists title text;
alter table public.promotions add column if not exists description text;
alter table public.promotions add column if not exists starts_at timestamptz;
alter table public.promotions add column if not exists ends_at timestamptz;
alter table public.promotions add column if not exists status text default 'draft';
alter table public.promotions add column if not exists payment_status text default 'unpaid';
alter table public.promotions add column if not exists provider text;
alter table public.promotions add column if not exists provider_checkout_id text;
alter table public.promotions add column if not exists provider_payment_id text;
alter table public.promotions add column if not exists created_at timestamptz default now();
alter table public.promotions add column if not exists updated_at timestamptz default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'promotions_promotion_type_check'
  ) then
    alter table public.promotions
      add constraint promotions_promotion_type_check
      check (promotion_type in ('highlight', 'featured', 'sponsored'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'promotions_target_type_check'
  ) then
    alter table public.promotions
      add constraint promotions_target_type_check
      check (target_type in ('event', 'vendor'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'promotions_status_check'
  ) then
    alter table public.promotions
      add constraint promotions_status_check
      check (status in ('draft', 'pending', 'active', 'paused', 'expired', 'cancelled'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'promotions_payment_status_check'
  ) then
    alter table public.promotions
      add constraint promotions_payment_status_check
      check (payment_status in ('unpaid', 'pending', 'paid', 'refunded', 'failed'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'promotions_target_reference_check'
  ) then
    alter table public.promotions
      add constraint promotions_target_reference_check
      check (
        (
          target_type = 'event'
          and event_id is not null
          and vendor_profile_id is null
        )
        or
        (
          target_type = 'vendor'
          and vendor_profile_id is not null
          and event_id is null
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'promotions_date_range_check'
  ) then
    alter table public.promotions
      add constraint promotions_date_range_check
      check (
        starts_at is null
        or ends_at is null
        or starts_at <= ends_at
      );
  end if;
end $$;

create index if not exists promotions_owner_id_idx on public.promotions(owner_id);
create index if not exists promotions_event_id_idx on public.promotions(event_id);
create index if not exists promotions_vendor_profile_id_idx on public.promotions(vendor_profile_id);
create index if not exists promotions_public_state_idx on public.promotions(status, payment_status, starts_at, ends_at);

alter table public.promotions enable row level security;

drop policy if exists promotions_select_own on public.promotions;
create policy promotions_select_own
on public.promotions
for select
to authenticated
using (owner_id = auth.uid());

drop policy if exists promotions_insert_own on public.promotions;
create policy promotions_insert_own
on public.promotions
for insert
to authenticated
with check (owner_id = auth.uid());

drop policy if exists promotions_update_own_editable on public.promotions;
create policy promotions_update_own_editable
on public.promotions
for update
to authenticated
using (
  owner_id = auth.uid()
  and status in ('draft', 'pending')
)
with check (
  owner_id = auth.uid()
  and status in ('draft', 'pending')
);

drop policy if exists promotions_delete_own_editable on public.promotions;
create policy promotions_delete_own_editable
on public.promotions
for delete
to authenticated
using (
  owner_id = auth.uid()
  and status in ('draft', 'pending')
);

drop policy if exists promotions_public_select_active_paid on public.promotions;
create policy promotions_public_select_active_paid
on public.promotions
for select
to anon, authenticated
using (
  status = 'active'
  and payment_status = 'paid'
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at >= now())
);

commit;
