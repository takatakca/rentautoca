-- Rentauto immutable handoff evidence + claims workflow.

update storage.buckets
set
  file_size_limit = 10485760,
  allowed_mime_types = array[
    'image/jpeg','image/png','image/webp','image/heic','image/heif'
  ]::text[]
where id = 'rentauto-trip-photos';

create table if not exists rentauto.trip_handoff_snapshots (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references rentauto.trips(id) on delete restrict,
  phase text not null check (phase in ('check_in','check_out')),
  submitted_by uuid not null references auth.users(id) on delete restrict,
  odometer_km numeric(12,1) not null check (odometer_km >= 0 and odometer_km <= 10000000),
  fuel_level text not null check (fuel_level in ('full','3/4','1/2','1/4','empty')),
  exterior_photos text[] not null,
  interior_photos text[] not null,
  location_confirmed boolean not null default false,
  damage_reported boolean not null default false,
  damage_notes text,
  tracking_consent_at timestamptz,
  submitted_at timestamptz not null default now(),
  evidence_hash text not null,
  constraint trip_handoff_snapshots_unique_phase unique (trip_id, phase),
  constraint trip_handoff_snapshots_exterior_min check (cardinality(exterior_photos) >= 4 and cardinality(exterior_photos) <= 20),
  constraint trip_handoff_snapshots_interior_min check (cardinality(interior_photos) >= 2 and cardinality(interior_photos) <= 20),
  constraint trip_handoff_snapshots_damage_notes_len check (damage_notes is null or char_length(damage_notes) <= 2000),
  constraint trip_handoff_snapshots_hash_format check (evidence_hash ~ '^[0-9a-f]{64}$')
);

create index if not exists trip_handoff_snapshots_trip_idx
  on rentauto.trip_handoff_snapshots (trip_id, submitted_at desc);

alter table rentauto.trip_handoff_snapshots enable row level security;
revoke all on table rentauto.trip_handoff_snapshots from public, anon, authenticated;
grant select on table rentauto.trip_handoff_snapshots to authenticated;
grant select, insert, update, delete on table rentauto.trip_handoff_snapshots to service_role;

drop policy if exists rentauto_handoff_snapshots_read on rentauto.trip_handoff_snapshots;
create policy rentauto_handoff_snapshots_read
on rentauto.trip_handoff_snapshots
for select to authenticated
using (
  exists (
    select 1
    from rentauto.trips t
    join rentauto.cars c on c.id=t.car_id
    where t.id=trip_handoff_snapshots.trip_id
      and (
        t.guest_id=(select auth.uid())
        or c.host_id=(select auth.uid())
        or rentauto.has_role('admin'::rentauto.app_role)
      )
  )
);

alter table rentauto.trip_incidents
  add column if not exists severity text not null default 'standard',
  add column if not exists resolution_code text,
  add column if not exists resolution_notes text,
  add column if not exists resolved_amount_cents integer,
  add column if not exists reviewed_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists evidence_hash text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='trip_incidents_severity_check'
      and conrelid='rentauto.trip_incidents'::regclass
  ) then
    alter table rentauto.trip_incidents
      add constraint trip_incidents_severity_check
      check (severity in ('standard','urgent','safety'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname='trip_incidents_resolution_amount_check'
      and conrelid='rentauto.trip_incidents'::regclass
  ) then
    alter table rentauto.trip_incidents
      add constraint trip_incidents_resolution_amount_check
      check (resolved_amount_cents is null or resolved_amount_cents >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname='trip_incidents_resolution_notes_len'
      and conrelid='rentauto.trip_incidents'::regclass
  ) then
    alter table rentauto.trip_incidents
      add constraint trip_incidents_resolution_notes_len
      check (resolution_notes is null or char_length(resolution_notes) <= 4000);
  end if;
end
$$;

create index if not exists trip_incidents_status_created_idx
  on rentauto.trip_incidents (status, created_at desc);
create index if not exists trip_incidents_trip_created_idx
  on rentauto.trip_incidents (trip_id, created_at desc);
create index if not exists trip_incidents_reviewer_idx
  on rentauto.trip_incidents (reviewed_by_user_id)
  where reviewed_by_user_id is not null;

create table if not exists rentauto.trip_incident_events (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references rentauto.trip_incidents(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists trip_incident_events_incident_created_idx
  on rentauto.trip_incident_events (incident_id, created_at);

alter table rentauto.trip_incident_events enable row level security;
revoke all on table rentauto.trip_incident_events from public, anon, authenticated;
grant select on table rentauto.trip_incident_events to authenticated;
grant select, insert, update, delete on table rentauto.trip_incident_events to service_role;

drop policy if exists rentauto_trip_incident_events_read on rentauto.trip_incident_events;
create policy rentauto_trip_incident_events_read
on rentauto.trip_incident_events
for select to authenticated
using (
  exists (
    select 1
    from rentauto.trip_incidents i
    join rentauto.trips t on t.id=i.trip_id
    join rentauto.cars c on c.id=t.car_id
    where i.id=trip_incident_events.incident_id
      and (
        t.guest_id=(select auth.uid())
        or c.host_id=(select auth.uid())
        or rentauto.has_role('admin'::rentauto.app_role)
      )
  )
);

create or replace function rentauto.prepare_incident_evidence()
returns trigger
language plpgsql
set search_path = rentauto, public, auth, extensions, pg_temp
as $$
begin
  if tg_op='INSERT' then
    if new.description is null or char_length(btrim(new.description)) < 10 then
      raise exception 'incident_description_too_short' using errcode='23514';
    end if;
    if char_length(new.description) > 4000 then
      raise exception 'incident_description_too_long' using errcode='23514';
    end if;
    if cardinality(new.photo_urls) > 20 then
      raise exception 'incident_photo_limit' using errcode='23514';
    end if;
    if new.type not in ('damage','accident','late_return','fuel','cleaning','lost_item','mechanical','safety','other') then
      raise exception 'invalid_incident_type' using errcode='23514';
    end if;
    if new.type in ('accident','safety') then
      new.severity := 'safety';
    end if;
    new.evidence_hash := encode(
      extensions.digest(
        jsonb_build_object(
          'trip_id',new.trip_id,
          'reporter_user_id',new.reporter_user_id,
          'type',new.type,
          'description',btrim(new.description),
          'photo_urls',to_jsonb(new.photo_urls),
          'created_at',new.created_at
        )::text,
        'sha256'
      ),
      'hex'
    );
  else
    if new.trip_id is distinct from old.trip_id
      or new.reporter_user_id is distinct from old.reporter_user_id
      or new.type is distinct from old.type
      or new.description is distinct from old.description
      or new.photo_urls is distinct from old.photo_urls
      or new.created_at is distinct from old.created_at
      or new.evidence_hash is distinct from old.evidence_hash then
      raise exception 'incident_evidence_immutable' using errcode='42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prepare_incident_evidence on rentauto.trip_incidents;
create trigger trg_prepare_incident_evidence
before insert or update on rentauto.trip_incidents
for each row execute function rentauto.prepare_incident_evidence();

create or replace function rentauto.notify_new_trip_incident()
returns trigger
language plpgsql
security definer
set search_path = rentauto, public, auth, pg_temp
as $$
declare
  v_guest uuid;
  v_host uuid;
  v_booking_reference text;
  v_counterparty uuid;
begin
  select t.guest_id,c.host_id,t.booking_reference
    into v_guest,v_host,v_booking_reference
  from rentauto.trips t
  join rentauto.cars c on c.id=t.car_id
  where t.id=new.trip_id;

  v_counterparty := case when new.reporter_user_id=v_guest then v_host else v_guest end;

  if v_counterparty is not null then
    insert into rentauto.notifications(user_id,type,title,body,link,payload)
    values (
      v_counterparty,
      'trip_incident',
      'Trip issue reported',
      'An issue was reported for booking ' ||
        coalesce(nullif(v_booking_reference,''),left(new.trip_id::text,8)) || '.',
      '/trips/' || new.trip_id::text,
      jsonb_build_object('tripId',new.trip_id,'incidentId',new.id,'severity',new.severity)
    );
  end if;

  insert into rentauto.trip_incident_events(incident_id,actor_user_id,event_type,payload_json)
  values (
    new.id,new.reporter_user_id,'incident_opened',
    jsonb_build_object('type',new.type,'severity',new.severity,'evidenceHash',new.evidence_hash)
  );

  return new;
end;
$$;

revoke all on function rentauto.notify_new_trip_incident()
from public, anon, authenticated;

drop trigger if exists trg_notify_new_trip_incident on rentauto.trip_incidents;
create trigger trg_notify_new_trip_incident
after insert on rentauto.trip_incidents
for each row execute function rentauto.notify_new_trip_incident();

create or replace function rentauto.capture_trip_handoff_snapshot()
returns trigger
language plpgsql
set search_path = rentauto, public, auth, extensions, pg_temp
as $$
declare
  v_phase text;
  v_payload jsonb;
  v_submitted_by uuid;
  v_odometer numeric;
  v_fuel text;
  v_exterior text[];
  v_interior text[];
  v_location_confirmed boolean;
  v_damage_reported boolean := false;
  v_damage_notes text;
  v_tracking_consent_at timestamptz;
  v_photo text;
  v_evidence jsonb;
  v_hash text;
  v_prefix text;
begin
  if new.status is not distinct from old.status then return new; end if;

  if new.status='active' then
    v_phase := 'check_in';
    v_prefix := new.id::text || '/check-in/';
    v_payload := coalesce(new.pricing_breakdown->'check_in','{}'::jsonb);
  elsif new.status='completed' then
    v_phase := 'check_out';
    v_prefix := new.id::text || '/check-out/';
    v_payload := coalesce(new.pricing_breakdown->'check_out','{}'::jsonb);
  else
    return new;
  end if;

  if jsonb_typeof(v_payload) <> 'object' then
    raise exception 'handoff_evidence_required' using errcode='23514';
  end if;

  begin
    v_submitted_by := (v_payload->>'by')::uuid;
    v_odometer := (v_payload->>'odometer_km')::numeric;
  exception when others then
    raise exception 'handoff_evidence_invalid' using errcode='23514';
  end;

  v_fuel := v_payload->>'fuel_level';
  v_location_confirmed := case
    when v_phase='check_in' then coalesce((v_payload->>'pickup_confirmed')::boolean,false)
    else coalesce((v_payload->>'return_confirmed')::boolean,false)
  end;
  v_damage_reported := case
    when v_phase='check_out' then coalesce((v_payload->>'damage_reported')::boolean,false)
    else false
  end;
  v_damage_notes := nullif(btrim(v_payload->>'damage_notes'),'');
  begin
    v_tracking_consent_at := nullif(v_payload->>'consent_accepted_at','')::timestamptz;
  exception when invalid_datetime_format then
    raise exception 'handoff_evidence_invalid' using errcode='23514';
  end;

  if v_submitted_by is null
     or v_odometer is null
     or v_odometer < 0
     or v_odometer > 10000000
     or v_fuel not in ('full','3/4','1/2','1/4','empty')
     or not v_location_confirmed then
    raise exception 'handoff_evidence_invalid' using errcode='23514';
  end if;

  if jsonb_typeof(coalesce(v_payload->'exterior_photos','[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(v_payload->'interior_photos','[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(v_payload->'exterior_photos','[]'::jsonb)) < 4
     or jsonb_array_length(coalesce(v_payload->'exterior_photos','[]'::jsonb)) > 20
     or jsonb_array_length(coalesce(v_payload->'interior_photos','[]'::jsonb)) < 2
     or jsonb_array_length(coalesce(v_payload->'interior_photos','[]'::jsonb)) > 20 then
    raise exception 'handoff_photo_evidence_required' using errcode='23514';
  end if;

  select array_agg(value order by ord) into v_exterior
  from jsonb_array_elements_text(v_payload->'exterior_photos') with ordinality as x(value,ord);

  select array_agg(value order by ord) into v_interior
  from jsonb_array_elements_text(v_payload->'interior_photos') with ordinality as x(value,ord);

  foreach v_photo in array coalesce(v_exterior,array[]::text[])
  loop
    if char_length(v_photo) > 1024 or v_photo not like v_prefix || '%' then
      raise exception 'handoff_photo_path_invalid' using errcode='23514';
    end if;
  end loop;

  foreach v_photo in array coalesce(v_interior,array[]::text[])
  loop
    if char_length(v_photo) > 1024 or v_photo not like v_prefix || '%' then
      raise exception 'handoff_photo_path_invalid' using errcode='23514';
    end if;
  end loop;

  if v_phase='check_out' then
    begin
      if (new.pricing_breakdown->'check_in'->>'odometer_km')::numeric > v_odometer then
        raise exception 'checkout_odometer_before_checkin' using errcode='23514';
      end if;
    exception when invalid_text_representation then
      raise exception 'checkin_odometer_missing' using errcode='23514';
    end;

    if v_damage_reported and (v_damage_notes is null or char_length(v_damage_notes) < 10) then
      raise exception 'damage_notes_required' using errcode='23514';
    end if;
  end if;

  v_evidence := jsonb_build_object(
    'trip_id',new.id,
    'phase',v_phase,
    'submitted_by',v_submitted_by,
    'odometer_km',v_odometer,
    'fuel_level',v_fuel,
    'exterior_photos',to_jsonb(v_exterior),
    'interior_photos',to_jsonb(v_interior),
    'location_confirmed',v_location_confirmed,
    'damage_reported',v_damage_reported,
    'damage_notes',v_damage_notes,
    'tracking_consent_at',v_tracking_consent_at,
    'submitted_at',coalesce(v_payload->>'at',now()::text)
  );

  v_hash := encode(extensions.digest(v_evidence::text,'sha256'),'hex');

  insert into rentauto.trip_handoff_snapshots(
    trip_id,phase,submitted_by,odometer_km,fuel_level,
    exterior_photos,interior_photos,location_confirmed,
    damage_reported,damage_notes,tracking_consent_at,submitted_at,evidence_hash
  ) values (
    new.id,v_phase,v_submitted_by,v_odometer,v_fuel,
    v_exterior,v_interior,v_location_confirmed,
    v_damage_reported,v_damage_notes,v_tracking_consent_at,
    coalesce(nullif(v_payload->>'at','')::timestamptz,now()),v_hash
  );

  return new;
end;
$$;

drop trigger if exists trg_capture_trip_handoff_snapshot on rentauto.trips;
create trigger trg_capture_trip_handoff_snapshot
before update of status,pricing_breakdown on rentauto.trips
for each row execute function rentauto.capture_trip_handoff_snapshot();

create or replace function rentauto.enforce_driver_verification_at_trip_start()
returns trigger
language plpgsql
set search_path = rentauto, public, auth, pg_temp
as $$
begin
  if new.status='active'
     and old.status is distinct from 'active'
     and not exists (
       select 1
       from rentauto.driver_verifications v
       where v.user_id=new.guest_id
         and v.status='approved'
         and v.license_expires_on is not null
         and v.license_expires_on >= current_date
     ) then
    raise exception 'driver_verification_required_at_pickup' using errcode='42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_driver_verification_at_trip_start on rentauto.trips;
create trigger trg_enforce_driver_verification_at_trip_start
before update of status on rentauto.trips
for each row execute function rentauto.enforce_driver_verification_at_trip_start();
