create table if not exists rentauto.settlement_operations (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references rentauto.trip_settlements(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  kind text not null check (kind in ('release','reversal')),
  request_key text not null unique,
  amount_cents integer not null check (amount_cents > 0),
  status text not null default 'prepared'
    check (status in ('prepared','completed','failed')),
  stripe_object_id text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists settlement_operations_settlement_status_idx
  on rentauto.settlement_operations(settlement_id,status,created_at desc);
create index if not exists settlement_operations_actor_idx
  on rentauto.settlement_operations(actor_user_id);

alter table rentauto.settlement_operations enable row level security;
revoke all on table rentauto.settlement_operations from public,anon,authenticated;
grant select on table rentauto.settlement_operations to authenticated;
grant select,insert,update,delete on table rentauto.settlement_operations to service_role;

drop policy if exists rentauto_settlement_operations_read on rentauto.settlement_operations;
create policy rentauto_settlement_operations_read
on rentauto.settlement_operations
for select to authenticated
using (
  exists (
    select 1
    from rentauto.trip_settlements s
    where s.id=settlement_operations.settlement_id
      and (
        s.host_id=(select auth.uid())
        or rentauto.has_role('admin'::rentauto.app_role)
      )
  )
);

create or replace function public.rentauto_prepare_settlement_release(
  p_settlement_id uuid,
  p_admin_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=public,rentauto,auth,pg_temp
as $$
declare
  v_settlement rentauto.trip_settlements%rowtype;
  v_trip rentauto.trips%rowtype;
  v_operation rentauto.settlement_operations%rowtype;
  v_key text;
begin
  if not rentauto.has_role('admin'::rentauto.app_role,p_admin_user_id) then
    raise exception 'admin_required' using errcode='42501';
  end if;

  v_key := 'rentauto-settlement-release-' || p_settlement_id::text;

  select s.* into v_settlement
  from rentauto.trip_settlements s
  where s.id=p_settlement_id
  for update;

  if not found then
    raise exception 'settlement_not_found' using errcode='P0002';
  end if;

  if v_settlement.status='processing' then
    select * into v_operation
    from rentauto.settlement_operations
    where request_key=v_key
      and settlement_id=p_settlement_id
      and kind='release'
      and status='prepared'
    order by created_at desc
    limit 1;

    if found then
      select * into v_trip from rentauto.trips where id=v_settlement.trip_id;
      return jsonb_build_object(
        'settlementId',v_settlement.id,
        'tripId',v_settlement.trip_id,
        'hostId',v_settlement.host_id,
        'amountCents',v_operation.amount_cents,
        'currency',v_settlement.currency,
        'paymentIntentId',v_settlement.source_payment_intent_id,
        'connectedAccountId',v_settlement.stripe_connected_account_id,
        'requestKey',v_key,
        'resumed',true
      );
    end if;
  end if;

  perform rentauto.refresh_trip_settlement(v_settlement.trip_id);

  select * into v_settlement
  from rentauto.trip_settlements
  where id=p_settlement_id
  for update;

  select * into v_trip from rentauto.trips where id=v_settlement.trip_id;

  if v_settlement.status <> 'eligible'
     or v_settlement.eligible_at is null
     or now() < v_settlement.eligible_at
     or v_settlement.host_amount_cents is null
     or v_settlement.host_amount_cents <= 0
     or v_settlement.stripe_connected_account_id is null
     or v_trip.status <> 'completed'
     or v_trip.payment_status <> 'paid' then
    raise exception 'settlement_not_eligible' using errcode='22023';
  end if;

  insert into rentauto.settlement_operations(
    settlement_id,actor_user_id,kind,request_key,amount_cents,status,
    stripe_object_id,last_error,updated_at
  )
  values (
    p_settlement_id,p_admin_user_id,'release',v_key,
    v_settlement.host_amount_cents,'prepared',null,null,now()
  )
  on conflict(request_key) do update set
    actor_user_id=excluded.actor_user_id,
    amount_cents=excluded.amount_cents,
    status='prepared',
    last_error=null,
    updated_at=now()
  returning * into v_operation;

  update rentauto.trip_settlements
  set status='processing',hold_reason=null,last_error=null,updated_at=now()
  where id=p_settlement_id;

  insert into rentauto.settlement_events(
    settlement_id,actor_user_id,event_type,payload_json
  ) values (
    p_settlement_id,p_admin_user_id,'transfer_processing',
    jsonb_build_object(
      'hostAmountCents',v_settlement.host_amount_cents,
      'requestKey',v_key
    )
  );

  return jsonb_build_object(
    'settlementId',v_settlement.id,
    'tripId',v_settlement.trip_id,
    'hostId',v_settlement.host_id,
    'amountCents',v_settlement.host_amount_cents,
    'currency',v_settlement.currency,
    'paymentIntentId',v_settlement.source_payment_intent_id,
    'connectedAccountId',v_settlement.stripe_connected_account_id,
    'requestKey',v_key,
    'resumed',false
  );
end;
$$;

revoke all on function public.rentauto_prepare_settlement_release(uuid,uuid)
from public,anon,authenticated;
grant execute on function public.rentauto_prepare_settlement_release(uuid,uuid)
to service_role;

create or replace function public.rentauto_record_settlement_transfer(
  p_settlement_id uuid,
  p_admin_user_id uuid,
  p_charge_id text,
  p_transfer_id text
)
returns jsonb
language plpgsql
security definer
set search_path=public,rentauto,auth,pg_temp
as $$
declare
  v_settlement rentauto.trip_settlements%rowtype;
  v_key text;
begin
  if not rentauto.has_role('admin'::rentauto.app_role,p_admin_user_id) then
    raise exception 'admin_required' using errcode='42501';
  end if;

  if p_charge_id is null or btrim(p_charge_id)=''
     or p_transfer_id is null or btrim(p_transfer_id)='' then
    raise exception 'invalid_transfer_record' using errcode='22023';
  end if;

  v_key := 'rentauto-settlement-release-' || p_settlement_id::text;

  select * into v_settlement
  from rentauto.trip_settlements
  where id=p_settlement_id
  for update;

  if not found then
    raise exception 'settlement_not_found' using errcode='P0002';
  end if;

  if v_settlement.status='transferred'
     and v_settlement.stripe_transfer_id=p_transfer_id then
    update rentauto.settlement_operations
    set status='completed',stripe_object_id=p_transfer_id,last_error=null,updated_at=now()
    where request_key=v_key;

    return jsonb_build_object('ok',true,'settlementId',v_settlement.id,'duplicate',true);
  end if;

  if v_settlement.status <> 'processing' then
    raise exception 'settlement_not_processing' using errcode='22023';
  end if;

  update rentauto.trip_settlements
  set
    source_charge_id=p_charge_id,
    stripe_transfer_id=p_transfer_id,
    status='transferred',
    transferred_at=coalesce(transferred_at,now()),
    last_error=null,
    updated_at=now()
  where id=p_settlement_id
  returning * into v_settlement;

  update rentauto.settlement_operations
  set status='completed',stripe_object_id=p_transfer_id,last_error=null,updated_at=now()
  where request_key=v_key;

  insert into rentauto.settlement_events(
    settlement_id,actor_user_id,event_type,payload_json
  ) values (
    p_settlement_id,p_admin_user_id,'transfer_completed',
    jsonb_build_object('chargeId',p_charge_id,'transferId',p_transfer_id,'requestKey',v_key)
  );

  insert into rentauto.notifications(user_id,type,title,body,link,payload)
  values (
    v_settlement.host_id,
    'host_payout_released',
    'Host earnings released',
    'Rentauto released your eligible trip earnings to your Stripe account.',
    '/host',
    jsonb_build_object(
      'tripId',v_settlement.trip_id,
      'settlementId',v_settlement.id,
      'amountCents',v_settlement.host_amount_cents,
      'currency',v_settlement.currency
    )
  );

  return jsonb_build_object('ok',true,'settlementId',v_settlement.id,'duplicate',false);
end;
$$;

revoke all on function public.rentauto_record_settlement_transfer(uuid,uuid,text,text)
from public,anon,authenticated;
grant execute on function public.rentauto_record_settlement_transfer(uuid,uuid,text,text)
to service_role;

create or replace function public.rentauto_record_settlement_failure(
  p_settlement_id uuid,
  p_admin_user_id uuid,
  p_error text
)
returns void
language plpgsql
security definer
set search_path=public,rentauto,auth,pg_temp
as $$
declare
  v_key text;
begin
  if not rentauto.has_role('admin'::rentauto.app_role,p_admin_user_id) then
    raise exception 'admin_required' using errcode='42501';
  end if;

  v_key := 'rentauto-settlement-release-' || p_settlement_id::text;

  update rentauto.trip_settlements
  set
    status='failed',
    hold_reason='transfer_failed',
    last_error=left(coalesce(p_error,'transfer_failed'),1000),
    updated_at=now()
  where id=p_settlement_id and status='processing';

  update rentauto.settlement_operations
  set
    status='failed',
    last_error=left(coalesce(p_error,'transfer_failed'),1000),
    updated_at=now()
  where request_key=v_key and status='prepared';

  insert into rentauto.settlement_events(
    settlement_id,actor_user_id,event_type,payload_json
  ) values (
    p_settlement_id,p_admin_user_id,'transfer_failed',
    jsonb_build_object('error',left(coalesce(p_error,'transfer_failed'),1000),'requestKey',v_key)
  );
end;
$$;

revoke all on function public.rentauto_record_settlement_failure(uuid,uuid,text)
from public,anon,authenticated;
grant execute on function public.rentauto_record_settlement_failure(uuid,uuid,text)
to service_role;

create or replace function public.rentauto_prepare_settlement_reversal(
  p_settlement_id uuid,
  p_admin_user_id uuid,
  p_amount_cents integer
)
returns jsonb
language plpgsql
security definer
set search_path=public,rentauto,auth,pg_temp
as $$
declare
  v_settlement rentauto.trip_settlements%rowtype;
  v_operation rentauto.settlement_operations%rowtype;
  v_remaining integer;
  v_key text;
begin
  if not rentauto.has_role('admin'::rentauto.app_role,p_admin_user_id) then
    raise exception 'admin_required' using errcode='42501';
  end if;

  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'invalid_reversal_amount' using errcode='22023';
  end if;

  select * into v_settlement
  from rentauto.trip_settlements
  where id=p_settlement_id
  for update;

  if not found then
    raise exception 'settlement_not_found' using errcode='P0002';
  end if;

  v_key :=
    'rentauto-settlement-reversal-' || p_settlement_id::text || '-' ||
    v_settlement.reversed_amount_cents::text || '-' || p_amount_cents::text;

  if v_settlement.status='reversing' then
    select * into v_operation
    from rentauto.settlement_operations
    where settlement_id=p_settlement_id
      and kind='reversal'
      and status='prepared'
    order by created_at desc
    limit 1;

    if found then
      if v_operation.request_key <> v_key or v_operation.amount_cents <> p_amount_cents then
        raise exception 'settlement_operation_in_progress' using errcode='55000';
      end if;

      return jsonb_build_object(
        'settlementId',v_settlement.id,
        'tripId',v_settlement.trip_id,
        'transferId',v_settlement.stripe_transfer_id,
        'amountCents',v_operation.amount_cents,
        'currency',v_settlement.currency,
        'reversedBeforeCents',v_settlement.reversed_amount_cents,
        'requestKey',v_operation.request_key,
        'resumed',true
      );
    end if;
  end if;

  if v_settlement.status not in ('transferred','reversal_required','partially_reversed')
     or v_settlement.stripe_transfer_id is null
     or v_settlement.host_amount_cents is null then
    raise exception 'settlement_not_reversible' using errcode='22023';
  end if;

  v_remaining := greatest(
    0,
    v_settlement.host_amount_cents-v_settlement.reversed_amount_cents
  );

  if p_amount_cents > v_remaining then
    raise exception 'reversal_amount_exceeds_remaining' using errcode='22023';
  end if;

  insert into rentauto.settlement_operations(
    settlement_id,actor_user_id,kind,request_key,amount_cents,status,
    stripe_object_id,last_error,updated_at
  )
  values (
    p_settlement_id,p_admin_user_id,'reversal',v_key,
    p_amount_cents,'prepared',null,null,now()
  )
  on conflict(request_key) do update set
    actor_user_id=excluded.actor_user_id,
    amount_cents=excluded.amount_cents,
    status='prepared',
    last_error=null,
    updated_at=now()
  returning * into v_operation;

  update rentauto.trip_settlements
  set status='reversing',last_error=null,updated_at=now()
  where id=p_settlement_id;

  insert into rentauto.settlement_events(
    settlement_id,actor_user_id,event_type,payload_json
  ) values (
    p_settlement_id,p_admin_user_id,'reversal_processing',
    jsonb_build_object(
      'amountCents',p_amount_cents,
      'reversedBeforeCents',v_settlement.reversed_amount_cents,
      'remainingBeforeCents',v_remaining,
      'requestKey',v_key
    )
  );

  return jsonb_build_object(
    'settlementId',v_settlement.id,
    'tripId',v_settlement.trip_id,
    'transferId',v_settlement.stripe_transfer_id,
    'amountCents',p_amount_cents,
    'currency',v_settlement.currency,
    'reversedBeforeCents',v_settlement.reversed_amount_cents,
    'requestKey',v_key,
    'resumed',false
  );
end;
$$;

revoke all on function public.rentauto_prepare_settlement_reversal(uuid,uuid,integer)
from public,anon,authenticated;
grant execute on function public.rentauto_prepare_settlement_reversal(uuid,uuid,integer)
to service_role;

create or replace function public.rentauto_record_settlement_reversal(
  p_settlement_id uuid,
  p_admin_user_id uuid,
  p_request_key text,
  p_reversal_id text,
  p_amount_cents integer,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path=public,rentauto,auth,pg_temp
as $$
declare
  v_settlement rentauto.trip_settlements%rowtype;
  v_existing rentauto.settlement_reversals%rowtype;
  v_new_reversed integer;
  v_status text;
begin
  if not rentauto.has_role('admin'::rentauto.app_role,p_admin_user_id) then
    raise exception 'admin_required' using errcode='42501';
  end if;

  if p_request_key is null or btrim(p_request_key)=''
     or p_reversal_id is null or btrim(p_reversal_id)=''
     or p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'invalid_reversal_record' using errcode='22023';
  end if;

  select * into v_existing
  from rentauto.settlement_reversals
  where request_key=p_request_key or stripe_reversal_id=p_reversal_id
  order by created_at asc
  limit 1;

  if found then
    if v_existing.settlement_id <> p_settlement_id
       or v_existing.amount_cents <> p_amount_cents then
      raise exception 'reversal_idempotency_conflict' using errcode='23505';
    end if;

    select * into v_settlement
    from rentauto.trip_settlements
    where id=p_settlement_id
    for update;

    if v_settlement.status='reversing' then
      v_status := case
        when v_settlement.reversed_amount_cents >= coalesce(v_settlement.host_amount_cents,0)
             and coalesce(v_settlement.host_amount_cents,0) > 0
          then 'reversed'
        when v_settlement.reversed_amount_cents > 0
          then 'partially_reversed'
        else 'reversal_required'
      end;

      update rentauto.trip_settlements
      set status=v_status,last_error=null,updated_at=now()
      where id=p_settlement_id
      returning * into v_settlement;
    end if;

    update rentauto.settlement_operations
    set status='completed',stripe_object_id=p_reversal_id,last_error=null,updated_at=now()
    where request_key=p_request_key;

    return jsonb_build_object(
      'ok',true,
      'settlementId',v_settlement.id,
      'status',v_settlement.status,
      'reversedAmountCents',v_settlement.reversed_amount_cents,
      'duplicate',true
    );
  end if;

  select * into v_settlement
  from rentauto.trip_settlements
  where id=p_settlement_id
  for update;

  if not found or v_settlement.status <> 'reversing'
     or v_settlement.host_amount_cents is null then
    raise exception 'settlement_not_reversing' using errcode='22023';
  end if;

  v_new_reversed := v_settlement.reversed_amount_cents+p_amount_cents;
  if v_new_reversed > v_settlement.host_amount_cents then
    raise exception 'reversal_amount_exceeds_transfer' using errcode='22023';
  end if;

  insert into rentauto.settlement_reversals(
    settlement_id,actor_user_id,request_key,stripe_reversal_id,
    amount_cents,reason
  ) values (
    p_settlement_id,p_admin_user_id,p_request_key,p_reversal_id,
    p_amount_cents,nullif(left(coalesce(p_reason,''),500),'')
  );

  v_status := case
    when v_new_reversed >= v_settlement.host_amount_cents then 'reversed'
    else 'partially_reversed'
  end;

  update rentauto.trip_settlements
  set
    reversed_amount_cents=v_new_reversed,
    stripe_transfer_reversal_id=p_reversal_id,
    status=v_status,
    reversed_at=case when v_status='reversed' then now() else reversed_at end,
    hold_reason=case when v_status='reversed' then null else hold_reason end,
    last_error=null,
    updated_at=now()
  where id=p_settlement_id
  returning * into v_settlement;

  update rentauto.settlement_operations
  set status='completed',stripe_object_id=p_reversal_id,last_error=null,updated_at=now()
  where request_key=p_request_key;

  insert into rentauto.settlement_events(
    settlement_id,actor_user_id,event_type,payload_json
  ) values (
    p_settlement_id,p_admin_user_id,'transfer_reversal_completed',
    jsonb_build_object(
      'reversalId',p_reversal_id,
      'amountCents',p_amount_cents,
      'totalReversedCents',v_settlement.reversed_amount_cents,
      'status',v_settlement.status,
      'requestKey',p_request_key
    )
  );

  return jsonb_build_object(
    'ok',true,
    'settlementId',v_settlement.id,
    'status',v_settlement.status,
    'reversedAmountCents',v_settlement.reversed_amount_cents,
    'duplicate',false
  );
end;
$$;

revoke all on function public.rentauto_record_settlement_reversal(uuid,uuid,text,text,integer,text)
from public,anon,authenticated;
grant execute on function public.rentauto_record_settlement_reversal(uuid,uuid,text,text,integer,text)
to service_role;

create or replace function public.rentauto_record_settlement_reversal_failure(
  p_settlement_id uuid,
  p_admin_user_id uuid,
  p_error text
)
returns void
language plpgsql
security definer
set search_path=public,rentauto,auth,pg_temp
as $$
begin
  if not rentauto.has_role('admin'::rentauto.app_role,p_admin_user_id) then
    raise exception 'admin_required' using errcode='42501';
  end if;

  update rentauto.trip_settlements
  set
    status='reversal_required',
    hold_reason='reversal_failed',
    last_error=left(coalesce(p_error,'reversal_failed'),1000),
    updated_at=now()
  where id=p_settlement_id and status='reversing';

  update rentauto.settlement_operations
  set
    status='failed',
    last_error=left(coalesce(p_error,'reversal_failed'),1000),
    updated_at=now()
  where settlement_id=p_settlement_id
    and kind='reversal'
    and status='prepared';

  insert into rentauto.settlement_events(
    settlement_id,actor_user_id,event_type,payload_json
  ) values (
    p_settlement_id,p_admin_user_id,'transfer_reversal_failed',
    jsonb_build_object('error',left(coalesce(p_error,'reversal_failed'),1000))
  );
end;
$$;

revoke all on function public.rentauto_record_settlement_reversal_failure(uuid,uuid,text)
from public,anon,authenticated;
grant execute on function public.rentauto_record_settlement_reversal_failure(uuid,uuid,text)
to service_role;

create or replace function public.rentauto_recover_stale_settlement_operations(
  p_admin_user_id uuid,
  p_older_than_minutes integer default 15
)
returns integer
language plpgsql
security definer
set search_path=public,rentauto,auth,pg_temp
as $$
declare
  v_count integer := 0;
  v_op record;
begin
  if not rentauto.has_role('admin'::rentauto.app_role,p_admin_user_id) then
    raise exception 'admin_required' using errcode='42501';
  end if;

  if p_older_than_minutes < 5 or p_older_than_minutes > 1440 then
    raise exception 'invalid_recovery_window' using errcode='22023';
  end if;

  for v_op in
    select *
    from rentauto.settlement_operations
    where status='prepared'
      and updated_at < now()-make_interval(mins=>p_older_than_minutes)
    for update skip locked
  loop
    update rentauto.settlement_operations
    set status='failed',last_error='stale_operation_recovered',updated_at=now()
    where id=v_op.id;

    if v_op.kind='release' then
      update rentauto.trip_settlements
      set status='failed',hold_reason='transfer_retry_required',
          last_error='stale_operation_recovered',updated_at=now()
      where id=v_op.settlement_id and status='processing';
    else
      update rentauto.trip_settlements
      set status='reversal_required',hold_reason='reversal_retry_required',
          last_error='stale_operation_recovered',updated_at=now()
      where id=v_op.settlement_id and status='reversing';
    end if;

    insert into rentauto.settlement_events(
      settlement_id,actor_user_id,event_type,payload_json
    ) values (
      v_op.settlement_id,p_admin_user_id,'stale_financial_operation_recovered',
      jsonb_build_object('kind',v_op.kind,'requestKey',v_op.request_key)
    );

    v_count := v_count+1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.rentauto_recover_stale_settlement_operations(uuid,integer)
from public,anon,authenticated;
grant execute on function public.rentauto_recover_stale_settlement_operations(uuid,integer)
to service_role;