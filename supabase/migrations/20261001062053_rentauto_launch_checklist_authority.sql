create table if not exists rentauto.launch_checklist_items (
  item_id text primary key,
  checked boolean not null default false,
  note text not null default '',
  updated_by uuid null,
  updated_at timestamptz not null default now(),
  constraint rentauto_launch_checklist_item_id_format
    check (item_id ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  constraint rentauto_launch_checklist_note_length
    check (char_length(note) <= 4000)
);

create table if not exists rentauto.launch_checklist_events (
  id bigint generated always as identity primary key,
  item_id text not null,
  previous_checked boolean null,
  checked boolean not null,
  previous_note text null,
  note text not null,
  changed_by uuid null,
  changed_at timestamptz not null default now(),
  constraint rentauto_launch_checklist_event_item_id_format
    check (item_id ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  constraint rentauto_launch_checklist_event_note_length
    check (char_length(note) <= 4000),
  constraint rentauto_launch_checklist_event_previous_note_length
    check (previous_note is null or char_length(previous_note) <= 4000)
);

alter table rentauto.launch_checklist_items enable row level security;
alter table rentauto.launch_checklist_events enable row level security;

revoke all on table rentauto.launch_checklist_items from public, anon, authenticated;
revoke all on table rentauto.launch_checklist_events from public, anon, authenticated;
revoke all on sequence rentauto.launch_checklist_events_id_seq from public, anon, authenticated;

grant select, insert, update on table rentauto.launch_checklist_items to authenticated;
grant select on table rentauto.launch_checklist_events to authenticated;

grant select, insert, update, delete on table rentauto.launch_checklist_items to service_role;
grant select, insert, update, delete on table rentauto.launch_checklist_events to service_role;
grant usage, select on sequence rentauto.launch_checklist_events_id_seq to service_role;

drop policy if exists rentauto_launch_checklist_items_admin_select
  on rentauto.launch_checklist_items;
create policy rentauto_launch_checklist_items_admin_select
  on rentauto.launch_checklist_items
  for select
  to authenticated
  using ((select rentauto.has_role('admin'::rentauto.app_role)));

drop policy if exists rentauto_launch_checklist_items_admin_insert
  on rentauto.launch_checklist_items;
create policy rentauto_launch_checklist_items_admin_insert
  on rentauto.launch_checklist_items
  for insert
  to authenticated
  with check ((select rentauto.has_role('admin'::rentauto.app_role)));

drop policy if exists rentauto_launch_checklist_items_admin_update
  on rentauto.launch_checklist_items;
create policy rentauto_launch_checklist_items_admin_update
  on rentauto.launch_checklist_items
  for update
  to authenticated
  using ((select rentauto.has_role('admin'::rentauto.app_role)))
  with check ((select rentauto.has_role('admin'::rentauto.app_role)));

drop policy if exists rentauto_launch_checklist_events_admin_select
  on rentauto.launch_checklist_events;
create policy rentauto_launch_checklist_events_admin_select
  on rentauto.launch_checklist_events
  for select
  to authenticated
  using ((select rentauto.has_role('admin'::rentauto.app_role)));

create or replace function rentauto.stamp_launch_checklist_item()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_by := auth.uid();
  new.updated_at := now();
  new.note := left(coalesce(new.note, ''), 4000);
  return new;
end;
$$;

create or replace function rentauto.audit_launch_checklist_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into rentauto.launch_checklist_events (
    item_id,
    previous_checked,
    checked,
    previous_note,
    note,
    changed_by,
    changed_at
  )
  values (
    new.item_id,
    case when tg_op = 'UPDATE' then old.checked else null end,
    new.checked,
    case when tg_op = 'UPDATE' then old.note else null end,
    new.note,
    new.updated_by,
    new.updated_at
  );
  return new;
end;
$$;

revoke all on function rentauto.stamp_launch_checklist_item() from public, anon;
revoke all on function rentauto.audit_launch_checklist_item() from public, anon, authenticated, service_role;

drop trigger if exists rentauto_launch_checklist_stamp
  on rentauto.launch_checklist_items;
create trigger rentauto_launch_checklist_stamp
before insert or update on rentauto.launch_checklist_items
for each row execute function rentauto.stamp_launch_checklist_item();

drop trigger if exists rentauto_launch_checklist_audit
  on rentauto.launch_checklist_items;
create trigger rentauto_launch_checklist_audit
after insert or update on rentauto.launch_checklist_items
for each row execute function rentauto.audit_launch_checklist_item();
