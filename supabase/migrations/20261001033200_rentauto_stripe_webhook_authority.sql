create or replace function public.rentauto_claim_stripe_webhook_event(
  p_event_id text,
  p_event_type text
)
returns table(should_process boolean,current_status text)
language plpgsql
security definer
set search_path=public,rentauto,pg_temp
as $$
declare
  v_row rentauto.stripe_webhook_events%rowtype;
begin
  if p_event_id is null or btrim(p_event_id)=''
     or p_event_type is null or btrim(p_event_type)='' then
    raise exception 'invalid_webhook_event' using errcode='22023';
  end if;

  insert into rentauto.stripe_webhook_events(
    stripe_event_id,event_type,status,attempt_count,
    processing_started_at,last_error
  )
  values (
    p_event_id,p_event_type,'processing',1,now(),null
  )
  on conflict(stripe_event_id) do nothing
  returning * into v_row;

  if found then
    should_process := true;
    current_status := 'processing';
    return next;
    return;
  end if;

  select *
  into v_row
  from rentauto.stripe_webhook_events
  where stripe_event_id=p_event_id
  for update;

  if not found then
    raise exception 'webhook_event_claim_failed' using errcode='55000';
  end if;

  if v_row.status='processed' then
    should_process := false;
    current_status := 'processed';
    return next;
    return;
  end if;

  if v_row.status='processing'
     and v_row.processing_started_at is not null
     and v_row.processing_started_at >= now()-interval '10 minutes' then
    should_process := false;
    current_status := 'processing';
    return next;
    return;
  end if;

  update rentauto.stripe_webhook_events
  set
    event_type=p_event_type,
    status='processing',
    attempt_count=attempt_count+1,
    processing_started_at=now(),
    processed_at=null,
    last_error=null
  where id=v_row.id;

  should_process := true;
  current_status := 'processing';
  return next;
end;
$$;

revoke all on function public.rentauto_claim_stripe_webhook_event(text,text)
from public,anon,authenticated;
grant execute on function public.rentauto_claim_stripe_webhook_event(text,text)
to service_role;

create or replace function public.rentauto_mark_stripe_webhook_processed(
  p_event_id text
)
returns void
language plpgsql
security definer
set search_path=public,rentauto,pg_temp
as $$
begin
  update rentauto.stripe_webhook_events
  set
    status='processed',
    processed_at=now(),
    processing_started_at=null,
    last_error=null
  where stripe_event_id=p_event_id;
end;
$$;

revoke all on function public.rentauto_mark_stripe_webhook_processed(text)
from public,anon,authenticated;
grant execute on function public.rentauto_mark_stripe_webhook_processed(text)
to service_role;

create or replace function public.rentauto_mark_stripe_webhook_failed(
  p_event_id text,
  p_error text
)
returns void
language plpgsql
security definer
set search_path=public,rentauto,pg_temp
as $$
begin
  update rentauto.stripe_webhook_events
  set
    status='failed',
    processing_started_at=null,
    last_error=left(coalesce(p_error,'webhook_processing_failed'),1000)
  where stripe_event_id=p_event_id;
end;
$$;

revoke all on function public.rentauto_mark_stripe_webhook_failed(text,text)
from public,anon,authenticated;
grant execute on function public.rentauto_mark_stripe_webhook_failed(text,text)
to service_role;
