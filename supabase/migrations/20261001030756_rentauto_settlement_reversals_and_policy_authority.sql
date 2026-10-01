alter table rentauto.trip_settlements
  add column if not exists reversed_amount_cents integer not null default 0;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname='trip_settlements_status_check'
      and conrelid='rentauto.trip_settlements'::regclass
  ) then
    alter table rentauto.trip_settlements
      drop constraint trip_settlements_status_check;
  end if;

  alter table rentauto.trip_settlements
    add constraint trip_settlements_status_check check (
      status in (
        'configuration_required',
        'pending_trip',
        'hold',
        'blocked',
        'eligible',
        'processing',
        'transferred',
        'failed',
        'reversal_required',
        'reversing',
        'partially_reversed',
        'reversed'
      )
    );

  if not exists (
    select 1 from pg_constraint
    where conname='trip_settlements_reversal_amount_check'
      and conrelid='rentauto.trip_settlements'::regclass
  ) then
    alter table rentauto.trip_settlements
      add constraint trip_settlements_reversal_amount_check check (
        reversed_amount_cents >= 0
        and (
          (host_amount_cents is null and reversed_amount_cents = 0)
          or
          (host_amount_cents is not null and reversed_amount_cents <= host_amount_cents)
        )
      );
  end if;
end
$$;

create table if not exists rentauto.settlement_reversals (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references rentauto.trip_settlements(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  request_key text not null unique,
  stripe_reversal_id text not null unique,
  amount_cents integer not null check (amount_cents > 0),
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists settlement_reversals_settlement_created_idx
  on rentauto.settlement_reversals(settlement_id,created_at desc);
create index if not exists settlement_reversals_actor_idx
  on rentauto.settlement_reversals(actor_user_id);

alter table rentauto.settlement_reversals enable row level security;
revoke all on table rentauto.settlement_reversals from public,anon,authenticated;
grant select on table rentauto.settlement_reversals to authenticated;
grant select,insert,update,delete on table rentauto.settlement_reversals to service_role;

drop policy if exists rentauto_settlement_reversals_read on rentauto.settlement_reversals;
create policy rentauto_settlement_reversals_read
on rentauto.settlement_reversals
for select to authenticated
using (
  exists (
    select 1
    from rentauto.trip_settlements s
    where s.id=settlement_reversals.settlement_id
      and (
        s.host_id=(select auth.uid())
        or rentauto.has_role('admin'::rentauto.app_role)
      )
  )
);

create or replace function rentauto.refresh_trip_settlement(p_trip_id uuid)
returns rentauto.trip_settlements
language plpgsql
security definer
set search_path = rentauto, public, auth, pg_temp
as $$
declare
  v_trip rentauto.trips%rowtype;
  v_car rentauto.cars%rowtype;
  v_policy rentauto.settlement_policy%rowtype;
  v_stripe rentauto.stripe_accounts%rowtype;
  v_settlement rentauto.trip_settlements%rowtype;
  v_rental_revenue integer;
  v_fee integer;
  v_host_amount integer;
  v_completed_at timestamptz;
  v_eligible_at timestamptz;
  v_block_reason text := null;
  v_next_status text;
  v_has_open_incident boolean := false;
  v_has_open_dispute boolean := false;
begin
  select * into v_trip
  from rentauto.trips
  where id=p_trip_id;

  if not found
     or v_trip.payment_status <> 'paid'
     or v_trip.stripe_payment_intent_id is null then
    return null;
  end if;

  select * into v_car from rentauto.cars where id=v_trip.car_id;
  if not found then
    raise exception 'settlement_vehicle_not_found' using errcode='P0002';
  end if;

  select * into v_policy from rentauto.settlement_policy where id=1;
  select * into v_stripe from rentauto.stripe_accounts where user_id=v_car.host_id;

  v_rental_revenue := greatest(
    0,
    coalesce(nullif(v_trip.pricing_breakdown->>'base_price','')::integer,0)
    + coalesce(nullif(v_trip.pricing_breakdown->>'extras_total','')::integer,0)
    - coalesce(nullif(v_trip.pricing_breakdown->>'discounts','')::integer,0)
  );

  select * into v_settlement
  from rentauto.trip_settlements
  where trip_id=p_trip_id;

  if found and v_settlement.status in (
    'transferred',
    'reversal_required',
    'reversing',
    'partially_reversed',
    'reversed',
    'processing'
  ) then
    return v_settlement;
  end if;

  v_completed_at := case
    when v_trip.status='completed'
      then coalesce(v_settlement.completed_at,v_trip.updated_at,now())
    else null
  end;

  if v_policy.id is null
     or not v_policy.payouts_enabled
     or v_policy.platform_fee_bps is null
     or v_policy.dispute_window_hours is null then
    v_fee := null;
    v_host_amount := null;
    v_eligible_at := null;
    v_next_status := 'configuration_required';
    v_block_reason := 'settlement_policy_not_configured';
  else
    v_fee := round(v_rental_revenue * v_policy.platform_fee_bps / 10000.0)::integer;
    v_host_amount := greatest(0,v_rental_revenue-v_fee);

    if v_trip.status <> 'completed' then
      v_eligible_at := null;
      v_next_status := 'pending_trip';
      v_block_reason := 'trip_not_completed';
    else
      v_eligible_at := v_completed_at + make_interval(hours=>v_policy.dispute_window_hours);

      select exists(
        select 1
        from rentauto.trip_incidents i
        where i.trip_id=p_trip_id and i.status in ('open','reviewing')
      ) into v_has_open_incident;

      select exists(
        select 1
        from rentauto.stripe_disputes d
        where d.trip_id=p_trip_id
          and d.status not in ('won','warning_closed')
      ) into v_has_open_dispute;

      if coalesce(v_settlement.refunded_cents,0) > 0 then
        v_next_status := 'blocked';
        v_block_reason := 'payment_refunded';
      elsif v_has_open_dispute then
        v_next_status := 'blocked';
        v_block_reason := 'payment_dispute';
      elsif v_has_open_incident then
        v_next_status := 'blocked';
        v_block_reason := 'trip_incident';
      elsif v_stripe.stripe_account_id is null
         or not coalesce(v_stripe.charges_enabled,false)
         or not coalesce(v_stripe.payouts_enabled,false) then
        v_next_status := 'blocked';
        v_block_reason := 'host_payout_account_not_ready';
      elsif now() < v_eligible_at then
        v_next_status := 'hold';
        v_block_reason := 'dispute_window';
      else
        v_next_status := 'eligible';
        v_block_reason := null;
      end if;
    end if;
  end if;

  insert into rentauto.trip_settlements(
    trip_id,host_id,guest_id,currency,source_payment_intent_id,
    stripe_connected_account_id,rental_revenue_cents,
    platform_fee_bps,platform_fee_cents,host_amount_cents,
    dispute_window_hours,completed_at,eligible_at,status,hold_reason,
    pricing_snapshot,updated_at
  )
  values (
    v_trip.id,v_car.host_id,v_trip.guest_id,upper(v_trip.currency),
    v_trip.stripe_payment_intent_id,v_stripe.stripe_account_id,
    v_rental_revenue,
    case when v_policy.id is null then null else v_policy.platform_fee_bps end,
    v_fee,v_host_amount,
    case when v_policy.id is null then null else v_policy.dispute_window_hours end,
    v_completed_at,v_eligible_at,v_next_status,v_block_reason,
    coalesce(v_trip.pricing_breakdown,'{}'::jsonb),now()
  )
  on conflict (trip_id) do update set
    host_id=excluded.host_id,
    guest_id=excluded.guest_id,
    currency=excluded.currency,
    source_payment_intent_id=excluded.source_payment_intent_id,
    stripe_connected_account_id=excluded.stripe_connected_account_id,
    rental_revenue_cents=excluded.rental_revenue_cents,
    platform_fee_bps=excluded.platform_fee_bps,
    platform_fee_cents=excluded.platform_fee_cents,
    host_amount_cents=excluded.host_amount_cents,
    dispute_window_hours=excluded.dispute_window_hours,
    completed_at=coalesce(rentauto.trip_settlements.completed_at,excluded.completed_at),
    eligible_at=excluded.eligible_at,
    status=case
      when rentauto.trip_settlements.status in (
        'transferred','reversal_required','reversing',
        'partially_reversed','reversed','processing'
      ) then rentauto.trip_settlements.status
      else excluded.status
    end,
    hold_reason=case
      when rentauto.trip_settlements.status in (
        'transferred','reversal_required','reversing',
        'partially_reversed','reversed','processing'
      ) then rentauto.trip_settlements.hold_reason
      else excluded.hold_reason
    end,
    pricing_snapshot=excluded.pricing_snapshot,
    updated_at=now()
  returning * into v_settlement;

  return v_settlement;
end;
$$;

revoke all on function rentauto.refresh_trip_settlement(uuid)
from public,anon,authenticated;
grant execute on function rentauto.refresh_trip_settlement(uuid) to service_role;

create or replace function public.rentauto_set_settlement_policy(
  p_admin_user_id uuid,
  p_payouts_enabled boolean,
  p_platform_fee_bps integer,
  p_dispute_window_hours integer
)
returns jsonb
language plpgsql
security definer
set search_path=public,rentauto,auth,pg_temp
as $$
declare
  v_row rentauto.settlement_policy%rowtype;
  v_trip record;
begin
  if not rentauto.has_role('admin'::rentauto.app_role,p_admin_user_id) then
    raise exception 'admin_required' using errcode='42501';
  end if;

  if p_platform_fee_bps is not null
     and (p_platform_fee_bps < 0 or p_platform_fee_bps > 10000) then
    raise exception 'invalid_platform_fee_bps' using errcode='22023';
  end if;

  if p_dispute_window_hours is not null
     and (p_dispute_window_hours < 0 or p_dispute_window_hours > 720) then
    raise exception 'invalid_dispute_window_hours' using errcode='22023';
  end if;

  if p_payouts_enabled
     and (p_platform_fee_bps is null or p_dispute_window_hours is null) then
    raise exception 'settlement_policy_values_required' using errcode='22023';
  end if;

  insert into rentauto.settlement_policy(
    id,payouts_enabled,platform_fee_bps,dispute_window_hours,
    updated_by_user_id,updated_at
  )
  values (
    1,p_payouts_enabled,p_platform_fee_bps,p_dispute_window_hours,
    p_admin_user_id,now()
  )
  on conflict(id) do update set
    payouts_enabled=excluded.payouts_enabled,
    platform_fee_bps=excluded.platform_fee_bps,
    dispute_window_hours=excluded.dispute_window_hours,
    updated_by_user_id=excluded.updated_by_user_id,
    updated_at=now()
  returning * into v_row;

  for v_trip in
    select id
    from rentauto.trips
    where payment_status='paid'
      and stripe_payment_intent_id is not null
  loop
    perform rentauto.refresh_trip_settlement(v_trip.id);
  end loop;

  insert into rentauto.settlement_events(
    settlement_id,actor_user_id,event_type,payload_json
  )
  select
    s.id,
    p_admin_user_id,
    'policy_refreshed',
    jsonb_build_object(
      'payoutsEnabled',v_row.payouts_enabled,
      'platformFeeBps',v_row.platform_fee_bps,
      'disputeWindowHours',v_row.dispute_window_hours
    )
  from rentauto.trip_settlements s
  where s.status not in ('transferred','reversed');

  return jsonb_build_object(
    'payoutsEnabled',v_row.payouts_enabled,
    'platformFeeBps',v_row.platform_fee_bps,
    'disputeWindowHours',v_row.dispute_window_hours,
    'updatedAt',v_row.updated_at
  );
end;
$$;

revoke all on function public.rentauto_set_settlement_policy(uuid,boolean,integer,integer)
from public,anon,authenticated;
grant execute on function public.rentauto_set_settlement_policy(uuid,boolean,integer,integer)
to service_role;

create or replace function public.rentauto_record_payment_refund(
  p_payment_intent_id text,
  p_refunded_cents integer
)
returns jsonb
language plpgsql
security definer
set search_path=public,rentauto,auth,pg_temp
as $$
declare
  v_settlement rentauto.trip_settlements%rowtype;
  v_previous integer;
begin
  if p_payment_intent_id is null or btrim(p_payment_intent_id)=''
     or p_refunded_cents is null or p_refunded_cents < 0 then
    raise exception 'invalid_refund_record' using errcode='22023';
  end if;

  select * into v_settlement
  from rentauto.trip_settlements
  where source_payment_intent_id=p_payment_intent_id
  for update;

  if not found then
    return jsonb_build_object('ok',true,'found',false);
  end if;

  v_previous := v_settlement.refunded_cents;

  update rentauto.trip_settlements
  set
    refunded_cents=greatest(refunded_cents,p_refunded_cents),
    status=case
      when status='reversed' then status
      when stripe_transfer_id is not null
           and status in ('transferred','partially_reversed','reversing')
        then 'reversal_required'
      else 'blocked'
    end,
    hold_reason='payment_refunded',
    updated_at=now()
  where id=v_settlement.id
  returning * into v_settlement;

  if v_settlement.refunded_cents <> v_previous then
    insert into rentauto.settlement_events(
      settlement_id,actor_user_id,event_type,payload_json
    ) values (
      v_settlement.id,null,'payment_refund_recorded',
      jsonb_build_object(
        'previousRefundedCents',v_previous,
        'refundedCents',v_settlement.refunded_cents
      )
    );
  end if;

  return jsonb_build_object(
    'ok',true,
    'found',true,
    'settlementId',v_settlement.id,
    'status',v_settlement.status,
    'refundedCents',v_settlement.refunded_cents
  );
end;
$$;

revoke all on function public.rentauto_record_payment_refund(text,integer)
from public,anon,authenticated;
grant execute on function public.rentauto_record_payment_refund(text,integer)
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
  v_remaining integer;
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
      'remainingBeforeCents',v_remaining
    )
  );

  return jsonb_build_object(
    'settlementId',v_settlement.id,
    'tripId',v_settlement.trip_id,
    'transferId',v_settlement.stripe_transfer_id,
    'amountCents',p_amount_cents,
    'currency',v_settlement.currency,
    'reversedBeforeCents',v_settlement.reversed_amount_cents
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
  )
  on conflict(stripe_reversal_id) do nothing;

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

  insert into rentauto.settlement_events(
    settlement_id,actor_user_id,event_type,payload_json
  ) values (
    p_settlement_id,p_admin_user_id,'transfer_reversal_completed',
    jsonb_build_object(
      'reversalId',p_reversal_id,
      'amountCents',p_amount_cents,
      'totalReversedCents',v_settlement.reversed_amount_cents,
      'status',v_settlement.status
    )
  );

  return jsonb_build_object(
    'ok',true,
    'settlementId',v_settlement.id,
    'status',v_settlement.status,
    'reversedAmountCents',v_settlement.reversed_amount_cents
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