alter table public.tasks
add column if not exists priority text;

alter table public.tasks
add column if not exists scope text;

update public.tasks
set priority = coalesce(priority, 'medium');

update public.tasks
set scope = coalesce(scope, 'own');

alter table public.tasks
alter column priority set default 'medium';

alter table public.tasks
alter column scope set default 'own';

alter table public.tasks
alter column priority set not null;

alter table public.tasks
alter column scope set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tasks_priority_check'
  ) then
    alter table public.tasks
    add constraint tasks_priority_check
    check (priority in ('low', 'medium', 'high'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tasks_scope_check'
  ) then
    alter table public.tasks
    add constraint tasks_scope_check
    check (scope in ('own', 'team'));
  end if;
end $$;
