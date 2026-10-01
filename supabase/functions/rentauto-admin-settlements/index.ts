import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@17?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function nullableInteger(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : Number.NaN;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");

  if (!supabaseUrl || !serviceKey) {
    return json({ error: "Service unavailable" }, 503);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "Unauthorized" }, 401);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } =
    await admin.auth.getUser(authHeader.slice(7));

  if (authError || !authData.user) {
    return json({ error: "Unauthorized" }, 401);
  }

  const rentauto = admin.schema("rentauto");
  const { data: adminRole } = await rentauto
    .from("account_roles")
    .select("id")
    .eq("auth_user_id", authData.user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (!adminRole) return json({ error: "Forbidden" }, 403);

  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > 12_000) {
      return json({ error: "Request too large" }, 413);
    }
    body = raw ? record(JSON.parse(raw)) : {};
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  const action = typeof body.action === "string" ? body.action : "list";

  if (action === "configure") {
    const payoutsEnabled = body.payoutsEnabled === true;
    const platformFeeBps = nullableInteger(body.platformFeeBps);
    const disputeWindowHours = nullableInteger(body.disputeWindowHours);

    if (
      Number.isNaN(platformFeeBps) ||
      Number.isNaN(disputeWindowHours) ||
      (platformFeeBps !== null && (platformFeeBps < 0 || platformFeeBps > 10_000)) ||
      (disputeWindowHours !== null &&
        (disputeWindowHours < 0 || disputeWindowHours > 720))
    ) {
      return json({ error: "Invalid settlement policy values" }, 400);
    }

    if (payoutsEnabled && (platformFeeBps === null || disputeWindowHours === null)) {
      return json(
        { error: "Fee and dispute window are required before enabling payouts." },
        400,
      );
    }

    const { data, error } = await admin.rpc("rentauto_set_settlement_policy", {
      p_admin_user_id: authData.user.id,
      p_payouts_enabled: payoutsEnabled,
      p_platform_fee_bps: platformFeeBps,
      p_dispute_window_hours: disputeWindowHours,
    });

    if (error) {
      console.error("[rentauto-admin-settlements] configure failed", error.code ?? "unknown");
      return json({ error: "Could not update settlement policy." }, 500);
    }

    return json({ ok: true, policy: data });
  }

  if (action === "refresh") {
    const settlementId =
      typeof body.settlementId === "string" ? body.settlementId : "";
    if (!UUID.test(settlementId)) {
      return json({ error: "Invalid settlement ID" }, 400);
    }

    const { data: settlement } = await rentauto
      .from("trip_settlements")
      .select("trip_id")
      .eq("id", settlementId)
      .maybeSingle();

    if (!settlement) return json({ error: "Settlement not found" }, 404);

    const { data, error } = await rentauto.rpc("refresh_trip_settlement", {
      p_trip_id: settlement.trip_id,
    });

    if (error) {
      return json({ error: "Settlement could not be refreshed." }, 500);
    }

    return json({ ok: true, settlement: data });
  }

  if (action === "release") {
    if (!stripeKey) return json({ error: "Stripe is not configured." }, 503);

    const settlementId =
      typeof body.settlementId === "string" ? body.settlementId : "";
    if (!UUID.test(settlementId)) {
      return json({ error: "Invalid settlement ID" }, 400);
    }

    let prepared = false;
    try {
      const { data: preparedData, error: prepareError } = await admin.rpc(
        "rentauto_prepare_settlement_release",
        {
          p_settlement_id: settlementId,
          p_admin_user_id: authData.user.id,
        },
      );

      if (prepareError) {
        return json(
          {
            error:
              prepareError.message.includes("settlement_not_eligible")
                ? "This payout is not eligible for release."
                : "Payout could not be prepared.",
          },
          prepareError.message.includes("settlement_not_eligible") ? 409 : 500,
        );
      }

      const preparedRow = record(preparedData);
      const tripId = String(preparedRow.tripId ?? "");
      const paymentIntentId = String(preparedRow.paymentIntentId ?? "");
      const connectedAccountId = String(preparedRow.connectedAccountId ?? "");
      const currency = String(preparedRow.currency ?? "").toLowerCase();
      const amountCents = Number(preparedRow.amountCents);

      if (
        !UUID.test(tripId) ||
        !paymentIntentId.startsWith("pi_") ||
        !connectedAccountId.startsWith("acct_") ||
        !/^[a-z]{3}$/.test(currency) ||
        !Number.isSafeInteger(amountCents) ||
        amountCents <= 0
      ) {
        throw new Error("invalid_prepared_settlement");
      }

      prepared = true;
      const stripe = new Stripe(stripeKey);
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
        expand: ["latest_charge"],
      });

      const latestCharge = paymentIntent.latest_charge;
      const chargeId =
        typeof latestCharge === "string"
          ? latestCharge
          : latestCharge && typeof latestCharge === "object"
            ? latestCharge.id
            : null;

      if (!chargeId?.startsWith("ch_")) {
        throw new Error("source_charge_missing");
      }

      const transfer = await stripe.transfers.create(
        {
          amount: amountCents,
          currency,
          destination: connectedAccountId,
          source_transaction: chargeId,
          transfer_group: `rentauto_trip_${tripId}`,
          metadata: {
            rentauto_trip_id: tripId,
            rentauto_settlement_id: settlementId,
          },
        },
        {
          idempotencyKey: `rentauto-settlement-release-${settlementId}`,
        },
      );

      const { data: recorded, error: recordError } = await admin.rpc(
        "rentauto_record_settlement_transfer",
        {
          p_settlement_id: settlementId,
          p_admin_user_id: authData.user.id,
          p_charge_id: chargeId,
          p_transfer_id: transfer.id,
        },
      );

      if (recordError) throw new Error("transfer_record_failed");

      return json({
        ok: true,
        settlement: recorded,
        transferId: transfer.id,
      });
    } catch (cause) {
      const safeError =
        cause instanceof Error ? cause.message : "payout_release_failed";

      if (prepared) {
        await admin.rpc("rentauto_record_settlement_failure", {
          p_settlement_id: settlementId,
          p_admin_user_id: authData.user.id,
          p_error: safeError,
        });
      }

      console.error("[rentauto-admin-settlements] release failed", safeError);
      return json({ error: "Payout release failed.", code: safeError }, 502);
    }
  }

  if (action === "reverse") {
    if (!stripeKey) return json({ error: "Stripe is not configured." }, 503);

    const settlementId =
      typeof body.settlementId === "string" ? body.settlementId : "";
    const amountCents = nullableInteger(body.amountCents);
    const reason =
      typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";

    if (
      !UUID.test(settlementId) ||
      amountCents === null ||
      Number.isNaN(amountCents) ||
      amountCents <= 0 ||
      reason.length < 5
    ) {
      return json({ error: "Valid reversal amount and reason are required." }, 400);
    }

    let prepared = false;
    try {
      const { data: preparedData, error: prepareError } = await admin.rpc(
        "rentauto_prepare_settlement_reversal",
        {
          p_settlement_id: settlementId,
          p_admin_user_id: authData.user.id,
          p_amount_cents: amountCents,
        },
      );

      if (prepareError) {
        return json(
          {
            error: prepareError.message.includes("not_reversible")
              ? "This settlement is not reversible."
              : prepareError.message.includes("exceeds_remaining")
                ? "Reversal amount exceeds the remaining transferred amount."
                : "Reversal could not be prepared.",
          },
          409,
        );
      }

      const preparedRow = record(preparedData);
      const transferId = String(preparedRow.transferId ?? "");
      const tripId = String(preparedRow.tripId ?? "");
      const reversedBeforeCents = Number(preparedRow.reversedBeforeCents);

      if (
        !transferId.startsWith("tr_") ||
        !UUID.test(tripId) ||
        !Number.isSafeInteger(reversedBeforeCents) ||
        reversedBeforeCents < 0
      ) {
        throw new Error("invalid_prepared_reversal");
      }

      prepared = true;
      const requestKey =
        `rentauto-settlement-reversal-${settlementId}-${reversedBeforeCents}-${amountCents}`;
      const stripe = new Stripe(stripeKey);
      const reversal = await stripe.transfers.createReversal(
        transferId,
        {
          amount: amountCents,
          description: reason,
          metadata: {
            rentauto_trip_id: tripId,
            rentauto_settlement_id: settlementId,
          },
        },
        { idempotencyKey: requestKey },
      );

      const { data: recorded, error: recordError } = await admin.rpc(
        "rentauto_record_settlement_reversal",
        {
          p_settlement_id: settlementId,
          p_admin_user_id: authData.user.id,
          p_request_key: requestKey,
          p_reversal_id: reversal.id,
          p_amount_cents: amountCents,
          p_reason: reason,
        },
      );

      if (recordError) throw new Error("reversal_record_failed");

      return json({
        ok: true,
        settlement: recorded,
        reversalId: reversal.id,
      });
    } catch (cause) {
      const safeError =
        cause instanceof Error ? cause.message : "payout_reversal_failed";

      if (prepared) {
        await admin.rpc("rentauto_record_settlement_reversal_failure", {
          p_settlement_id: settlementId,
          p_admin_user_id: authData.user.id,
          p_error: safeError,
        });
      }

      console.error("[rentauto-admin-settlements] reversal failed", safeError);
      return json({ error: "Payout reversal failed.", code: safeError }, 502);
    }
  }

  if (action !== "list") return json({ error: "Invalid action" }, 400);

  const requestedStatus = typeof body.status === "string" ? body.status : "all";
  const allowedStatuses = new Set([
    "configuration_required",
    "pending_trip",
    "hold",
    "blocked",
    "eligible",
    "processing",
    "transferred",
    "failed",
    "reversal_required",
    "reversing",
    "partially_reversed",
    "reversed",
    "all",
  ]);
  const status = allowedStatuses.has(requestedStatus) ? requestedStatus : "all";

  const { data: policy } = await rentauto
    .from("settlement_policy")
    .select("payouts_enabled,platform_fee_bps,dispute_window_hours,updated_at")
    .eq("id", 1)
    .maybeSingle();

  let settlementsQuery = rentauto
    .from("trip_settlements")
    .select(
      "id,trip_id,host_id,guest_id,currency,rental_revenue_cents,platform_fee_bps,platform_fee_cents,host_amount_cents,refunded_cents,reversed_amount_cents,completed_at,eligible_at,status,hold_reason,stripe_transfer_id,transferred_at,reversed_at,last_error,created_at,updated_at",
    )
    .order("updated_at", { ascending: false })
    .limit(200);

  if (status !== "all") settlementsQuery = settlementsQuery.eq("status", status);

  const { data: settlements, error: settlementsError } = await settlementsQuery;
  if (settlementsError) return json({ error: "Could not load settlements." }, 500);

  const tripIds = [...new Set((settlements ?? []).map((row) => row.trip_id))];
  const tripsById = new Map<string, Record<string, unknown>>();
  const carsById = new Map<string, Record<string, unknown>>();

  if (tripIds.length > 0) {
    const { data: trips } = await rentauto
      .from("trips")
      .select("id,booking_reference,status,car_id,start_at,end_at")
      .in("id", tripIds);

    for (const trip of trips ?? []) tripsById.set(trip.id, trip);

    const carIds = [...new Set((trips ?? []).map((trip) => trip.car_id))];
    if (carIds.length > 0) {
      const { data: cars } = await rentauto
        .from("cars")
        .select("id,title,year,make,model")
        .in("id", carIds);
      for (const car of cars ?? []) carsById.set(car.id, car);
    }
  }

  const hostIds = [...new Set((settlements ?? []).map((row) => row.host_id))];
  const profilesById = new Map<string, Record<string, unknown>>();
  if (hostIds.length > 0) {
    const { data: profiles } = await rentauto
      .from("profiles")
      .select("id,display_name,first_name,last_name")
      .in("id", hostIds);
    for (const profile of profiles ?? []) profilesById.set(profile.id, profile);
  }

  const result = (settlements ?? []).map((settlement) => {
    const trip = tripsById.get(settlement.trip_id);
    const carId = typeof trip?.car_id === "string" ? trip.car_id : null;
    const car = carId ? carsById.get(carId) : null;
    const profile = profilesById.get(settlement.host_id);
    const hostName =
      typeof profile?.display_name === "string" && profile.display_name.trim()
        ? profile.display_name
        : [profile?.first_name, profile?.last_name]
            .filter((value) => typeof value === "string" && value.trim())
            .join(" ") || "Host";

    const vehicle =
      typeof car?.title === "string" && car.title.trim()
        ? car.title
        : car
          ? [car.year, car.make, car.model].filter(Boolean).join(" ")
          : "Vehicle";

    return {
      ...settlement,
      bookingReference:
        typeof trip?.booking_reference === "string" ? trip.booking_reference : null,
      tripStatus: typeof trip?.status === "string" ? trip.status : null,
      tripStartAt: typeof trip?.start_at === "string" ? trip.start_at : null,
      tripEndAt: typeof trip?.end_at === "string" ? trip.end_at : null,
      hostName,
      vehicle,
    };
  });

  return json({
    policy: policy ?? {
      payouts_enabled: false,
      platform_fee_bps: null,
      dispute_window_hours: null,
      updated_at: null,
    },
    settlements: result,
  });
});