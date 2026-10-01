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
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : Number.NaN;
}

type ServiceClient = ReturnType<typeof createClient>;

async function processRefund(
  admin: ServiceClient,
  stripeKey: string | undefined,
  preparedValue: unknown,
) {
  const prepared = record(preparedValue);
  const cancellationId = String(prepared.cancellationId ?? "");
  const tripId = String(prepared.tripId ?? "");
  const paymentIntentId = String(prepared.paymentIntentId ?? "");
  const stripeRefundId =
    typeof prepared.stripeRefundId === "string" ? prepared.stripeRefundId : null;
  const idempotencyKey = String(prepared.idempotencyKey ?? "");
  const resumeMode = String(prepared.resumeMode ?? "create");
  const actorRole = String(prepared.actorRole ?? "");
  const refundAmountCents = Number(prepared.refundAmountCents);

  if (
    !UUID.test(cancellationId) ||
    !UUID.test(tripId) ||
    !paymentIntentId.startsWith("pi_") ||
    !Number.isSafeInteger(refundAmountCents) ||
    refundAmountCents <= 0 ||
    !idempotencyKey.startsWith("rentauto-cancel-")
  ) {
    throw new Error("invalid_prepared_cancellation");
  }

  if (!stripeKey) throw new Error("stripe_not_configured");

  const stripe = new Stripe(stripeKey);
  let refund: Stripe.Refund;

  if (resumeMode === "retrieve" && stripeRefundId?.startsWith("re_")) {
    refund = await stripe.refunds.retrieve(stripeRefundId);
  } else {
    const params: Stripe.RefundCreateParams = {
      payment_intent: paymentIntentId,
      amount: refundAmountCents,
      metadata: {
        rentauto_trip_id: tripId,
        rentauto_cancellation_id: cancellationId,
        rentauto_actor_role: actorRole,
      },
    };

    if (actorRole === "guest") {
      params.reason = "requested_by_customer";
    }

    refund = await stripe.refunds.create(params, {
      idempotencyKey,
    });
  }

  const refundStatus = String(refund.status ?? "pending");
  const { data: synced, error: syncError } = await admin
    .schema("rentauto")
    .rpc("record_trip_cancellation_refund", {
      p_cancellation_id: cancellationId,
      p_stripe_refund_id: refund.id,
      p_refund_status: refundStatus,
    });

  if (syncError) {
    console.error(
      "[rentauto-cancel-trip] refund record failed",
      syncError.code ?? "unknown",
    );
    throw new Error("refund_record_failed");
  }

  return {
    refundId: refund.id,
    refundStatus,
    cancellation: synced,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");

  if (!supabaseUrl || !serviceKey) return json({ error: "Service unavailable" }, 503);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } =
    await admin.auth.getUser(authHeader.slice(7));

  if (authError || !authData.user) return json({ error: "Unauthorized" }, 401);

  let body: Record<string, unknown> = {};
  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > 16_000) {
      return json({ error: "Request too large" }, 413);
    }
    body = raw ? record(JSON.parse(raw)) : {};
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  const action = typeof body.action === "string" ? body.action : "preview";
  const rentauto = admin.schema("rentauto");

  const isAdmin = async () => {
    const { data } = await rentauto
      .from("account_roles")
      .select("id")
      .eq("auth_user_id", authData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    return Boolean(data);
  };

  if (action === "preview") {
    const tripId = typeof body.tripId === "string" ? body.tripId : "";
    if (!UUID.test(tripId)) return json({ error: "Invalid trip ID" }, 400);

    const { data, error } = await rentauto.rpc("preview_trip_cancellation", {
      p_user_id: authData.user.id,
      p_trip_id: tripId,
    });

    if (error) {
      const message = error.message ?? "";
      if (message.includes("trip_not_found")) return json({ error: "Trip not found" }, 404);
      if (message.includes("trip_forbidden")) return json({ error: "Forbidden" }, 403);
      if (message.includes("trip_not_cancellable")) {
        return json({ error: "This trip can no longer be cancelled normally." }, 409);
      }
      return json({ error: "Cancellation preview unavailable." }, 500);
    }

    return json({ preview: data });
  }

  if (action === "cancel") {
    const tripId = typeof body.tripId === "string" ? body.tripId : "";
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";

    if (!UUID.test(tripId) || reason.length < 5 || reason.length > 1000) {
      return json({ error: "A valid trip and cancellation reason are required." }, 400);
    }

    const { data: prepared, error: prepareError } = await rentauto.rpc(
      "prepare_trip_cancellation",
      {
        p_user_id: authData.user.id,
        p_trip_id: tripId,
        p_reason: reason,
      },
    );

    if (prepareError) {
      const message = prepareError.message ?? "";
      if (message.includes("trip_not_found")) return json({ error: "Trip not found" }, 404);
      if (message.includes("trip_forbidden")) return json({ error: "Forbidden" }, 403);
      if (message.includes("trip_not_cancellable")) {
        return json({ error: "This trip can no longer be cancelled normally." }, 409);
      }
      if (message.includes("cancellation_already_requested")) {
        return json(
          { error: "The other trip participant already started a cancellation workflow." },
          409,
        );
      }
      return json({ error: "Cancellation could not be prepared." }, 500);
    }

    const preparedRow = record(prepared);
    if (preparedRow.manualReview === true) {
      return json(
        {
          ok: true,
          manualReview: true,
          cancellation: preparedRow,
        },
        202,
      );
    }

    if (preparedRow.requiresRefund !== true) {
      return json({ ok: true, cancellation: preparedRow });
    }

    try {
      const result = await processRefund(admin, stripeKey, prepared);
      return json({ ok: true, ...result });
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "refund_processing_failed";
      console.error("[rentauto-cancel-trip] refund attempt interrupted", code);
      return json(
        {
          error:
            code === "stripe_not_configured"
              ? "Stripe refund service is not configured."
              : "Refund processing could not be completed. It can be safely retried.",
          code,
        },
        code === "stripe_not_configured" ? 503 : 502,
      );
    }
  }

  if (!(await isAdmin())) return json({ error: "Forbidden" }, 403);

  if (action === "resolve") {
    const cancellationId =
      typeof body.cancellationId === "string" ? body.cancellationId : "";
    const decision =
      body.decision === "approve" || body.decision === "deny"
        ? body.decision
        : "";
    const refundAmountCents = nullableInteger(body.refundAmountCents);
    const notes = typeof body.notes === "string" ? body.notes.trim() : "";

    if (
      !UUID.test(cancellationId) ||
      !decision ||
      notes.length < 10 ||
      notes.length > 4000 ||
      Number.isNaN(refundAmountCents)
    ) {
      return json({ error: "Invalid cancellation resolution." }, 400);
    }

    const { data: prepared, error } = await rentauto.rpc(
      "prepare_manual_cancellation_resolution",
      {
        p_admin_user_id: authData.user.id,
        p_cancellation_id: cancellationId,
        p_decision: decision,
        p_refund_amount_cents:
          decision === "approve" ? refundAmountCents : null,
        p_notes: notes,
      },
    );

    if (error) {
      return json({ error: "Cancellation resolution could not be saved." }, 409);
    }

    const preparedRow = record(prepared);
    if (preparedRow.requiresRefund !== true) {
      return json({ ok: true, cancellation: preparedRow });
    }

    try {
      const result = await processRefund(admin, stripeKey, prepared);
      return json({ ok: true, ...result });
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "refund_processing_failed";
      console.error("[rentauto-cancel-trip] manual refund interrupted", code);
      return json(
        {
          error:
            code === "stripe_not_configured"
              ? "Stripe refund service is not configured."
              : "Refund processing could not be completed. It can be safely retried.",
          code,
        },
        code === "stripe_not_configured" ? 503 : 502,
      );
    }
  }

  if (action === "retry") {
    const cancellationId =
      typeof body.cancellationId === "string" ? body.cancellationId : "";
    if (!UUID.test(cancellationId)) return json({ error: "Invalid cancellation ID" }, 400);

    const { data: prepared, error } = await rentauto.rpc(
      "prepare_cancellation_retry",
      {
        p_admin_user_id: authData.user.id,
        p_cancellation_id: cancellationId,
      },
    );

    if (error) return json({ error: "Cancellation refund is not retryable." }, 409);

    try {
      const result = await processRefund(admin, stripeKey, prepared);
      return json({ ok: true, ...result });
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "refund_processing_failed";
      console.error("[rentauto-cancel-trip] retry interrupted", code);
      return json(
        {
          error:
            code === "stripe_not_configured"
              ? "Stripe refund service is not configured."
              : "Refund retry could not be completed. It can be safely retried.",
          code,
        },
        code === "stripe_not_configured" ? 503 : 502,
      );
    }
  }

  if (action !== "list") return json({ error: "Invalid action" }, 400);

  const requestedStatus = typeof body.status === "string" ? body.status : "all";
  const allowed = new Set([
    "manual_review",
    "processing",
    "refund_pending",
    "refunded",
    "cancelled_unpaid",
    "cancelled_no_refund",
    "failed",
    "denied",
    "all",
  ]);
  const status = allowed.has(requestedStatus) ? requestedStatus : "all";

  let query = rentauto
    .from("trip_cancellations")
    .select(
      "id,trip_id,actor_user_id,actor_role,reason,policy_snapshot,rule_source,refund_percentage,refund_amount_cents,original_total_cents,currency,status,stripe_refund_id,attempt_count,resolution_notes,resolved_by_user_id,requested_at,updated_at,resolved_at",
    )
    .order("requested_at", { ascending: false })
    .limit(200);

  if (status !== "all") query = query.eq("status", status);

  const { data: cancellations, error: listError } = await query;
  if (listError) return json({ error: "Could not load cancellations." }, 500);

  const tripIds = [...new Set((cancellations ?? []).map((row) => row.trip_id))];
  const tripsById = new Map<string, Record<string, unknown>>();
  const carsById = new Map<string, Record<string, unknown>>();

  if (tripIds.length > 0) {
    const { data: trips } = await rentauto
      .from("trips")
      .select("id,booking_reference,status,payment_status,car_id,guest_id,start_at,end_at")
      .in("id", tripIds);

    for (const trip of trips ?? []) tripsById.set(trip.id, trip);

    const carIds = [...new Set((trips ?? []).map((trip) => trip.car_id))];
    if (carIds.length > 0) {
      const { data: cars } = await rentauto
        .from("cars")
        .select("id,host_id,title,year,make,model")
        .in("id", carIds);
      for (const car of cars ?? []) carsById.set(car.id, car);
    }
  }

  const rows = (cancellations ?? []).map((cancellation) => {
    const trip = tripsById.get(cancellation.trip_id);
    const carId = typeof trip?.car_id === "string" ? trip.car_id : null;
    const car = carId ? carsById.get(carId) : null;

    return {
      ...cancellation,
      bookingReference:
        typeof trip?.booking_reference === "string"
          ? trip.booking_reference
          : null,
      tripStatus: typeof trip?.status === "string" ? trip.status : null,
      paymentStatus:
        typeof trip?.payment_status === "string" ? trip.payment_status : null,
      vehicle: car
        ? typeof car.title === "string" && car.title.trim()
          ? car.title
          : [car.year, car.make, car.model].filter(Boolean).join(" ")
        : "Vehicle",
    };
  });

  return json({ cancellations: rows });
});
