-- Project Rentauto trips into the shared TAKATAK marketplace model and keep refunds atomic.

create or replace function rentauto.project_trip_to_takatak_marketplace_order(
  p_trip_id uuid
)
returns uuid
language plpgsql
security definer
set search_path=rentauto,public,auth,pg_temp
as $$
declare
  v_trip rentauto.trips%rowtype;
  v_account rentauto.accounts%rowtype;
  v_order_id uuid;
  v_payment_status text;
  v_fulfillment_status text;
  v_total numeric;
begin
  select *
  into v_trip
  from rentauto.trips
  where id=p_trip_id;

  if not found or v_trip.status='draft' then
    return null;
  end if;

  select *
  into v_account
  from rentauto.accounts
  where auth_user_id=v_trip.guest_id;

  v_payment_status := case lower(coalesce(v_trip.payment_status,'pending'))
    when 'paid' then 'PAID'
    when 'refunded' then 'REFUNDED'
    when 'partially_refunded' then 'PARTIALLY_REFUNDED'
    when 'failed' then 'FAILED'
    else 'PENDING'
  end;

  v_fulfillment_status := upper(coalesce(v_trip.status,'UNKNOWN'));
  v_total := round(coalesce(v_trip.total_cents,0)::numeric / 100.0, 2);

  insert into public.source_marketplace_orders(
    id,
    "sourceApplication",
    "externalOrderId",
    "externalOrderNumber",
    "identityId",
    "sourceMerchantId",
    "companyId",
    "customerReference",
    total,
    currency,
    "paymentStatus",
    "fulfillmentStatus",
    "occurredAt",
    "collectedFields",
    "createdAt",
    "updatedAt"
  )
  values (
    gen_random_uuid(),
    'RENTAUTO',
    v_trip.id::text,
    v_trip.booking_reference,
    v_account.master_identity_id,
    null,
    null,
    v_trip.guest_id::text,
    v_total,
    upper(coalesce(v_trip.currency,'CAD')),
    v_payment_status,
    v_fulfillment_status,
    timezone('UTC',coalesce(v_trip.created_at,now())),
    jsonb_build_object(
      'tripId',v_trip.id,
      'bookingReference',v_trip.booking_reference,
      'guestId',v_trip.guest_id,
      'carId',v_trip.car_id,
      'startAt',v_trip.start_at,
      'endAt',v_trip.end_at,
      'pickupLocation',v_trip.pickup_location,
      'returnLocation',v_trip.return_location,
      'tripStatus',v_trip.status,
      'paymentStatus',v_trip.payment_status,
      'totalMinor',v_trip.total_cents,
      'currency',upper(coalesce(v_trip.currency,'CAD')),
      'pricingBreakdown',coalesce(v_trip.pricing_breakdown,'{}'::jsonb)
    ),
    timezone('UTC',now()),
    timezone('UTC',now())
  )
  on conflict ("sourceApplication","externalOrderId") do update set
    "externalOrderNumber"=excluded."externalOrderNumber",
    "identityId"=excluded."identityId",
    "customerReference"=excluded."customerReference",
    total=excluded.total,
    currency=excluded.currency,
    "paymentStatus"=excluded."paymentStatus",
    "fulfillmentStatus"=excluded."fulfillmentStatus",
    "collectedFields"=excluded."collectedFields",
    "updatedAt"=timezone('UTC',now())
  returning id into v_order_id;

  return v_order_id;
end;
$$;

revoke all on function rentauto.project_trip_to_takatak_marketplace_order(uuid)
from public,anon,authenticated;
grant execute on function rentauto.project_trip_to_takatak_marketplace_order(uuid)
to service_role;

create or replace function rentauto.sync_takatak_marketplace_order_trigger()
returns trigger
language plpgsql
security definer
set search_path=rentauto,public,auth,pg_temp
as $$
begin
  if new.status <> 'draft' then
    perform rentauto.project_trip_to_takatak_marketplace_order(new.id);
  end if;
  return new;
end;
$$;

revoke all on function rentauto.sync_takatak_marketplace_order_trigger()
from public,anon,authenticated;

drop trigger if exists trg_sync_takatak_marketplace_order on rentauto.trips;
create trigger trg_sync_takatak_marketplace_order
after insert or update on rentauto.trips
for each row
execute function rentauto.sync_takatak_marketplace_order_trigger();

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
  v_trip rentauto.trips%rowtype;
  v_summary public.source_payment_summaries%rowtype;
  v_previous integer;
  v_payment_status text;
begin
  if p_payment_intent_id is null or btrim(p_payment_intent_id)=''
     or p_refunded_cents is null or p_refunded_cents < 0 then
    raise exception 'invalid_refund_record' using errcode='22023';
  end if;

  select *
  into v_settlement
  from rentauto.trip_settlements
  where source_payment_intent_id=p_payment_intent_id
  for update;

  if not found then
    return jsonb_build_object('ok',true,'found',false);
  end if;

  select *
  into v_trip
  from rentauto.trips
  where id=v_settlement.trip_id
  for update;

  if not found then
    raise exception 'refund_trip_not_found' using errcode='P0002';
  end if;

  v_previous := v_settlement.refunded_cents;
  v_payment_status := case
    when p_refunded_cents >= coalesce(v_trip.total_cents,0) then 'refunded'
    else 'partially_refunded'
  end;

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

  update rentauto.trips
  set
    payment_status=v_payment_status,
    updated_at=now()
  where id=v_trip.id
  returning * into v_trip;

  update public.source_payment_summaries
  set
    status=upper(v_payment_status),
    "refundedAmountMinor"=greatest(coalesce("refundedAmountMinor",0),p_refunded_cents),
    "updatedAt"=timezone('UTC',now())
  where "sourceApplication"='RENTAUTO'
    and "bookingNumber"=v_trip.booking_reference
  returning * into v_summary;

  if v_settlement.refunded_cents <> v_previous then
    insert into rentauto.settlement_events(
      settlement_id,actor_user_id,event_type,payload_json
    ) values (
      v_settlement.id,null,'payment_refund_recorded',
      jsonb_build_object(
        'previousRefundedCents',v_previous,
        'refundedCents',v_settlement.refunded_cents,
        'paymentStatus',v_payment_status
      )
    );

    insert into rentauto.trip_events(
      trip_id,actor_user_id,event_type,payload_json
    ) values (
      v_trip.id,
      null,
      'stripe_refund_recorded',
      jsonb_build_object(
        'payment_intent_id',p_payment_intent_id,
        'refunded_cents',v_settlement.refunded_cents,
        'payment_status',v_payment_status
      )
    );

    if v_summary.id is not null then
      insert into public.source_synchronization_events(
        id,
        "eventId",
        "eventType",
        "sourceApplication",
        "sourceProfileId",
        "identityId",
        "payloadHash",
        "responsePayload",
        status,
        "processedAt",
        "createdAt"
      )
      values (
        gen_random_uuid(),
        'rentauto-refund-' || v_trip.id::text || '-' || v_settlement.refunded_cents::text,
        'PAYMENT_SUMMARY_UPDATED',
        'RENTAUTO',
        v_summary."sourceProfileId",
        v_summary."identityId",
        md5(
          v_trip.booking_reference || ':' ||
          v_payment_status || ':' ||
          v_settlement.refunded_cents::text
        ),
        jsonb_build_object(
          'bookingNumber',v_trip.booking_reference,
          'status',upper(v_payment_status),
          'amountMinor',v_summary."amountMinor",
          'refundedAmountMinor',v_settlement.refunded_cents,
          'currency',v_summary.currency
        ),
        'PROCESSED',
        timezone('UTC',now()),
        timezone('UTC',now())
      )
      on conflict ("eventId") do nothing;
    end if;
  end if;

  return jsonb_build_object(
    'ok',true,
    'found',true,
    'settlementId',v_settlement.id,
    'tripId',v_trip.id,
    'status',v_settlement.status,
    'paymentStatus',v_payment_status,
    'refundedCents',v_settlement.refunded_cents
  );
end;
$$;

revoke all on function public.rentauto_record_payment_refund(text,integer)
from public,anon,authenticated;
grant execute on function public.rentauto_record_payment_refund(text,integer)
to service_role;

do $$
declare
  v_trip record;
begin
  for v_trip in
    select id
    from rentauto.trips
    where status <> 'draft'
  loop
    perform rentauto.project_trip_to_takatak_marketplace_order(v_trip.id);
  end loop;
end
$$;
