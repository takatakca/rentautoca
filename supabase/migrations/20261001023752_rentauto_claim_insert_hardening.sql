create or replace function rentauto.prepare_incident_evidence()
returns trigger
language plpgsql
set search_path = rentauto, public, auth, extensions, pg_temp
as $$
declare
  v_trip_status text;
  v_photo text;
begin
  if tg_op='INSERT' then
    select t.status
      into v_trip_status
    from rentauto.trips t
    where t.id=new.trip_id;

    if v_trip_status is null
       or v_trip_status not in (
         'confirmed','check_in_pending','active','check_out_pending','completed','cancelled'
       ) then
      raise exception 'incident_not_available_for_trip' using errcode='23514';
    end if;

    if new.description is null or char_length(btrim(new.description)) < 10 then
      raise exception 'incident_description_too_short' using errcode='23514';
    end if;

    if char_length(new.description) > 4000 then
      raise exception 'incident_description_too_long' using errcode='23514';
    end if;

    if cardinality(new.photo_urls) > 20 then
      raise exception 'incident_photo_limit' using errcode='23514';
    end if;

    if new.type not in (
      'damage','accident','late_return','fuel','cleaning',
      'lost_item','mechanical','safety','other'
    ) then
      raise exception 'invalid_incident_type' using errcode='23514';
    end if;

    foreach v_photo in array coalesce(new.photo_urls,array[]::text[])
    loop
      if char_length(v_photo) > 1024
         or v_photo not like new.trip_id::text || '/incidents/%' then
        raise exception 'incident_photo_path_invalid' using errcode='23514';
      end if;
    end loop;

    new.status := 'open';
    new.severity := case
      when new.type in ('accident','safety') then 'safety'
      else 'standard'
    end;
    new.resolution_code := null;
    new.resolution_notes := null;
    new.resolved_amount_cents := null;
    new.reviewed_by_user_id := null;
    new.reviewed_at := null;
    new.created_at := now();
    new.updated_at := new.created_at;

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