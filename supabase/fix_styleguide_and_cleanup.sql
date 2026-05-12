alter table public.profiles
  add column if not exists has_seen_style_guide boolean default false;

update public.profiles
set has_seen_style_guide = false
where has_seen_style_guide is null;

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);
