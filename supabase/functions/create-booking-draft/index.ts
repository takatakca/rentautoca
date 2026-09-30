import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { buildTripQuote, TripQuoteError } from "../_shared/pricing.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function response(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function bookingError(message: string | undefined) {
  const value = message ?? "";
  if (
    value.includes("dates_not_available") ||
    value.includes("dates_temporarily_held") ||
    value.includes("booking_holds_active_no_overlap")
  ) {
    return response(
      { error: "Dates are no longer available", code: "DATES_NOT_AVAILABLE" },
      409,
    );
  }
  if (value.includes("host_cannot_book_own_vehicle")) {
    return response(
      { error: "You cannot book your own vehicle", code: "OWN_VEHICLE" },
      403,
    );
  }
  if (value.includes("vehicle_not_available")) {
    return response(
      { error: "Vehicle is not available", code: "VEHICLE_NOT_AVAILABLE" },
      409,
    );
  }
  if (
    value.includes("invalid_trip_dates") ||
    value.includes("trip_start_in_past") ||
    value.includes("trip_duration_too_long")
  ) {
    return response(
      { error: "Trip dates are invalid", code: "INVALID_TRIP_DATES" },
      400,
    );
  }
  return response(
    { error: "Could not start booking", code: "BOOKING_START_FAILED" },
    500,
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return response({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return response({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return response({ error: "Service unavailable" }, 503);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const token = authHeader.slice(7);
  const { data: claims, error: claimsError } = await userClient.auth.getClaims(token);
  const userId = claims?.claims?.sub;
  if (claimsError || typeof userId !== "string" || !userId) {
    return response({ error: "Unauthorized" }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return response({ error: "Invalid request body" }, 400);
  }

  const carId = typeof body.carId === "string" ? body.carId : "";
  const startAt = typeof body.startAt === "string" ? body.startAt : "";
  const endAt = typeof body.endAt === "string" ? body.endAt : "";
  const selectedExtras = Array.isArray(body.selectedExtras)
    ? body.selectedExtras
    : [];
  const protectionPlanId =
    typeof body.protectionPlanId === "string" ? body.protectionPlanId : null;
  const pickupLocation =
    typeof body.pickupLocation === "string" ? body.pickupLocation.slice(0, 500) : null;
  const returnLocation =
    typeof body.returnLocation === "string" ? body.returnLocation.slice(0, 500) : null;

  if (!carId || !startAt || !endAt) {
    return response({ error: "Vehicle and trip dates are required" }, 400);
  }

  const { data: created, error: createError } = await userClient.rpc(
    "create_booking_draft_and_hold",
    {
      p_car_id: carId,
      p_start_at: startAt,
      p_end_at: endAt,
      p_pickup_location: pickupLocation,
      p_return_location: returnLocation,
    },
  );

  if (createError || !Array.isArray(created) || !created[0]?.trip_id) {
    return bookingError(createError?.message);
  }

  const tripId = String(created[0].trip_id);
  const holdExpiresAt = String(created[0].hold_expires_at);
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const quote = await buildTripQuote(admin, {
      carId,
      startAt,
      endAt,
      selectedExtras,
      protectionPlanId,
      ignoreHoldTripId: tripId,
    });

    const { error: updateError } = await admin
      .from("trips")
      .update({
        total_cents: quote.total_after_tax,
        currency: quote.currency,
        pricing_breakdown: quote,
      })
      .eq("id", tripId)
      .eq("guest_id", userId)
      .eq("status", "draft");

    if (updateError) throw updateError;

    return response(
      {
        tripId,
        holdExpiresAt,
        quote,
      },
      201,
    );
  } catch (cause) {
    await admin
      .from("booking_holds")
      .update({ status: "released", updated_at: new Date().toISOString() })
      .eq("trip_id", tripId)
      .eq("status", "active");

    await admin
      .from("trips")
      .update({ status: "cancelled" })
      .eq("id", tripId)
      .eq("status", "draft");

    if (cause instanceof TripQuoteError) {
      const status = cause.status === 500 ? 500 : cause.status;
      return response(
        {
          error:
            cause.code === "DATES_NOT_AVAILABLE" ||
            cause.code === "DATES_TEMPORARILY_HELD"
              ? "Dates are no longer available"
              : "Could not confirm booking price",
          code: cause.code,
        },
        status,
      );
    }

    console.error("[create-booking-draft] Server quote failed");
    return response(
      { error: "Could not start booking", code: "BOOKING_START_FAILED" },
      500,
    );
  }
});
