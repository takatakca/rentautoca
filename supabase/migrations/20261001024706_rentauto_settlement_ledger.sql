-- Rentauto settlement ledger and payout authority.
create table if not exists rentauto.settlement_policy (
  id smallint primary key default 1 check (id = 1),
  payouts_enabled boolean not null default false,
  platform_fee_bps integer,
  dispute_window_hours integer,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint settlement_policy_fee_check
    check (platform_fee_bps is null or (platform_fee_bps >= 0 and platform_fee_bps <= 10000)),
  constraint settlement_policy_window_check
    check (dispute_window_hours is null or (dispute_window_hours >= 0 and dispute_window_hours <= 720)),
  constraint settlement_policy_enabled_requires_values
    check (
      not payouts_enabled
      or (platform_fee_bps is not null and dispute_window_hours is not null)
    )
);

alter table rentauto.settlement_policy enable row level security;
revoke all on table rentauto.settlement_policy from public, anon, authenticated;
grant select, insert, update, delete on table rentauto.settlement_policy to service_role;

create table if not exists rentauto.trip_settlements (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null unique references rentauto.trips(id) on delete restrict,
  host_id uuid not null references auth.users(id) on delete restrict,
  guest_id uuid not null references auth.users(id) on delete restrict,
  currency text not null,
  source_payment_intent_id text not null,
  source_charge_id text,
  stripe_connected_account_id text,
  rental_revenue_cents integer not null,
  platform_fee_bps integer,
  platform_fee_cents integer,
  host_amount_cents integer,
  dispute_window_hours integer,
  completed_at timestamptz,
  eligible_at timestamptz,
  status text not null default 'configuration_required',
  hold_reason text,
  refunded_cents integer not null default 0,
  dispute_id text,
  dispute_status text,
  stripe_transfer_id text,
  stripe_transfer_reversal_id text,
  transferred_at timestamptz,
  reversed_at timestamptz,
  last_error text,
  pricing_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_settlements_status_check check (
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
      'reversed'
    )
  ),
  constraint trip_settlements_amounts_check check (
    rental_revenue_cents >= 0
    and refunded_cents >= 0
    and (platform_fee_cents is null or platform_fee_cents >= 0)
    and (host_amount_cents is null or host_amount_cents >= 0)
  ),
  constraint trip_settlements_currency_check check (currency ~ '^[A-Z]{3}$')
);

create unique index if not exists trip_settlements_transfer_id_uidx
  on rentauto.trip_settlements(stripe_transfer_id)
  where stripe_transfer_id is not null;

create index if not exists trip_settlements_host_status_idx
  on rentauto.trip_settlements(host_id,status,eligible_at);

create index if not exists trip_settlements_status_eligible_idx
  on rentauto.trip_settlements(status,eligible_at);

create index if not exists trip_settlements_guest_idx
  on rentauto.trip_settlements(guest_id);

alter table rentauto.trip_settlements enable row level security;
revoke all on table rentauto.trip_settlements from public, anon, authenticated;
grant select on table rentauto.trip_settlements to authenticated;
grant select, insert, update, delete on table rentauto.trip_settlements to service_role;

drop policy if exists rentauto_trip_settlements_host_read on rentauto.trip_settlements;
create policy rentauto_trip_settlements_host_read
on rentauto.trip_settlements
for select to authenticated
using (
  host_id = (select auth.uid())
  or rentauto.has_role('admin'::rentauto.app_role)
);

create table if not exists rentauto.settlement_events (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references rentauto.trip_settlements(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists settlement_events_settlement_created_idx
  on rentauto.settlement_events(settlement_id,created_at);

create index if not exists settlement_events_actor_idx
  on rentauto.settlement_events(actor_user_id)
  where actor_user_id is not null;

alter table rentauto.settlement_events enable row level security;
revoke all on table rentauto.settlement_events from public, anon, authenticated;
grant select on table rentauto.settlement_events to authenticated;
grant select, insert, update, delete on table rentauto.settlement_events to service_role;

drop policy if exists rentauto_settlement_events_read on rentauto.settlement_events;
create policy rentauto_settlement_events_read
on rentauto.settlement_events
for select to authenticated
using (
  exists (
    select 1
    from rentauto.trip_settlements s
    where s.id = settlement_events.settlement_id
      and (
        s.host_id = (select auth.uid())
        or rentauto.has_role('admin'::rentauto.app_role)
      )
  )
);

create table if not exists rentauto.stripe_disputes (
  id uuid primary key default gen_random_uuid(),
  stripe_dispute_id text not null unique,
  trip_id uuid not null references rentauto.trips(id) on delete restrict,
  payment_intent_id text not null,
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  reason text,
  status text not null,
  evidence_due_by timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);

create index if not exists stripe_disputes_trip_status_idx
  on rentauto.stripe_disputes(trip_id,status);

alter table rentauto.stripe_disputes enable row level security;
revoke all on table rentauto.stripe_disputes from public, anon, authenticated;
grant select, insert, update, delete on table rentauto.stripe_disputes to service_role;

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
  where id = p_trip_id;

  if not found or v_trip.payment_status <> 'paid' or v_trip.stripe_payment_intent_id is null then
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

  if found and v_settlement.status in ('transferred','reversed','processing') then
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
        select 1 from rentauto.trip_incidents i
        where i.trip_id=p_trip_id and i.status in ('open','reviewing')
      ) into v_has_open_incident;

      select exists(
        select 1 from rentauto.stripe_disputes d
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
      when rentauto.trip_settlements.status in ('transferred','reversed','processing')
        then rentauto.trip_settlements.status
      else excluded.status
    end,
    hold_reason=case
      when rentauto.trip_settlements.status in ('transferred','reversed','processing')
        then rentauto.trip_settlements.hold_reason
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

create or replace function rentauto.sync_trip_settlement_trigger()
returns trigger
language plpgsql
security definer
set search_path=rentauto,public,auth,pg_temp
as $$
begin
  if new.payment_status='paid' and new.stripe_payment_intent_id is not null then
    perform rentauto.refresh_trip_settlement(new.id);
  end if;
  return new;
end;
$$;

revoke all on function rentauto.sync_trip_settlement_trigger()
from public,anon,authenticated;

drop trigger if exists trg_sync_trip_settlement on rentauto.trips;
create trigger trg_sync_trip_settlement
after insert or update of payment_status,status,pricing_breakdown,stripe_payment_intent_id
on rentauto.trips
for each row
execute function rentauto.sync_trip_settlement_trigger();

create or replace function rentauto.refresh_settlement_for_incident_trigger()
returns trigger
language plpgsql
security definer
set search_path=rentauto,public,auth,pg_temp
as $$
begin
  perform rentauto.refresh_trip_settlement(coalesce(new.trip_id,old.trip_id));
  return coalesce(new,old);
end;
$$;

revoke all on function rentauto.refresh_settlement_for_incident_trigger()
from public,anon,authenticated;

drop trigger if exists trg_refresh_settlement_for_incident on rentauto.trip_incidents;
create trigger trg_refresh_settlement_for_incident
after insert or update of status on rentauto.trip_incidents
for each row
execute function rentauto.refresh_settlement_for_incident_trigger();

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
begin
  if not rentauto.has_role('admin'::rentauto.app_role,p_admin_user_id) then
    raise exception 'admin_required' using errcode='42501';
  end if;

  select s.* into v_settlement
  from rentauto.trip_settlements s
  where s.id=p_settlement_id
  for update;

  if not found then
    raise exception 'settlement_not_found' using errcode='P0002';
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

  update rentauto.trip_settlements
  set status='processing',hold_reason=null,last_error=null,updated_at=now()
  where id=p_settlement_id;

  insert into rentauto.settlement_events(
    settlement_id,actor_user_id,event_type,payload_json
  ) values (
    p_settlement_id,p_admin_user_id,'transfer_processing',
    jsonb_build_object('hostAmountCents',v_settlement.host_amount_cents)
  );

  return jsonb_build_object(
    'settlementId',v_settlement.id,
    'tripId',v_settlement.trip_id,
    'hostId',v_settlement.host_id,
    'amountCents',v_settlement.host_amount_cents,
    'currency',v_settlement.currency,
    'paymentIntentId',v_settlement.source_payment_intent_id,
    'connectedAccountId',v_settlement.stripe_connected_account_id
  );
end;
$$;

revoke all on function public.rentauto_prepare_settlement_release(uuid,uuid)
from public,anon,authenticated;
grant execute on function public.rentauto_prepare_settlement_release(uuid,uuid) to service_role;

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
begin
  if not rentauto.has_role('admin'::rentauto.app_role,p_admin_user_id) then
    raise exception 'admin_required' using errcode='42501';
  end if;

  if p_charge_id is null or btrim(p_charge_id)=''
     or p_transfer_id is null or btrim(p_transfer_id)='' then
    raise exception 'invalid_transfer_record' using errcode='22023';
  end if;

  update rentauto.trip_settlements
  set
    source_charge_id=p_charge_id,
    stripe_transfer_id=p_transfer_id,
    status='transferred',
    transferred_at=now(),
    last_error=null,
    updated_at=now()
  where id=p_settlement_id
    and status='processing'
  returning * into v_settlement;

  if not found then
    raise exception 'settlement_not_processing' using errcode='22023';
  end if;

  insert into rentauto.settlement_events(
    settlement_id,actor_user_id,event_type,payload_json
  ) values (
    p_settlement_id,p_admin_user_id,'transfer_completed',
    jsonb_build_object('chargeId',p_charge_id,'transferId',p_transfer_id)
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

  return jsonb_build_object('ok',true,'settlementId',v_settlement.id);
end;
$$;

revoke all on function public.rentauto_record_settlement_transfer(uuid,uuid,text,text)
from public,anon,authenticated;
grant execute on function public.rentauto_record_settlement_transfer(uuid,uuid,text,text) to service_role;

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
begin
  if not rentauto.has_role('admin'::rentauto.app_role,p_admin_user_id) then
    raise exception 'admin_required' using errcode='42501';
  end if;

  update rentauto.trip_settlements
  set
    status='failed',
    hold_reason='transfer_failed',
    last_error=left(coalesce(p_error,'transfer_failed'),1000),
    updated_at=now()
  where id=p_settlement_id and status='processing';

  insert into rentauto.settlement_events(
    settlement_id,actor_user_id,event_type,payload_json
  ) values (
    p_settlement_id,p_admin_user_id,'transfer_failed',
    jsonb_build_object('error',left(coalesce(p_error,'transfer_failed'),1000))
  );
end;
$$;

revoke all on function public.rentauto_record_settlement_failure(uuid,uuid,text)
from public,anon,authenticated;
grant execute on function public.rentauto_record_settlement_failure(uuid,uuid,text) to service_role;

select rentauto.refresh_trip_settlement(t.id)
from rentauto.trips t
where t.payment_status='paid'
  and t.stripe_payment_intent_id is not null;
