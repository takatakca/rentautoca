import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@17?target=deno";
import { buildTripQuote, TripQuoteError } from "../_shared/pricing.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!stripeKey) {
      return json(
        {
          error: "PAYMENT_NOT_CONFIGURED",
          message: "Payment provider is not configured.",
        },
        503,
      );
    }
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json({ error: "Service unavailable" }, 503);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const token = authHeader.slice(7);
    const { data: claims, error: claimsError } =
      await userClient.auth.getClaims(token);

    const userId = claims?.claims?.sub;
    if (claimsError || typeof userId !== "string" || !userId) {
      return json({ error: "Unauthorized" }, 401);
    }

    const body = asRecord(await req.json());
    const tripId = typeof body.tripId === "string" ? body.tripId : "";
    const returnPath =
      typeof body.returnPath === "string" ? body.returnPath : null;
    const legacyReturnUrl =
      typeof body.returnUrl === "string" ? body.returnUrl : null;

    if (!tripId) {
      return json({ error: "tripId required" }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: trip, error: tripError } = await admin
      .from("trips")
      .select(
        "id,guest_id,car_id,start_at,end_at,status,total_cents,currency,pricing_breakdown,stripe_session_id",
      )
      .eq("id", tripId)
      .maybeSingle();

    if (tripError || !trip || trip.guest_id !== userId) {
      return json({ error: "Not found" }, 404);
    }

    if (!["draft", "pending_payment"].includes(trip.status)) {
      return json({ error: "Trip cannot be paid in current status" }, 409);
    }

    const { data: hold, error: holdError } = await admin
      .from("booking_holds")
      .select("id,status,expires_at")
      .eq("trip_id", trip.id)
      .eq("status", "active")
      .maybeSingle();

    if (
      holdError ||
      !hold ||
      new Date(hold.expires_at).getTime() <= Date.now()
    ) {
      return json(
        {
          error: "Booking hold expired",
          code: "BOOKING_HOLD_EXPIRED",
        },
        409,
      );
    }

    const storedPricing = asRecord(trip.pricing_breakdown);
    const selectedExtras = Array.isArray(storedPricing.selected_extra_ids)
      ? storedPricing.selected_extra_ids.filter(
          (value): value is string => typeof value === "string",
        )
      : [];
    const protectionPlanId =
      typeof storedPricing.protection_plan_id === "string"
        ? storedPricing.protection_plan_id
        : null;

    let quote;
    try {
      quote = await buildTripQuote(admin, {
        carId: trip.car_id,
        startAt: trip.start_at,
        endAt: trip.end_at,
        selectedExtras,
        protectionPlanId,
        ignoreHoldTripId: trip.id,
      });
    } catch (cause) {
      if (cause instanceof TripQuoteError) {
        return json(
          {
            error:
              cause.code === "DATES_NOT_AVAILABLE" ||
              cause.code === "DATES_TEMPORARILY_HELD"
                ? "Dates are no longer available"
                : "Booking price could not be confirmed",
            code: cause.code,
          },
          cause.status,
        );
      }
      throw cause;
    }

    const checkoutHoldExpiry = new Date(Date.now() + 35 * 60 * 1000);
    const { error: extendError } = await admin.rpc(
      "extend_booking_hold_for_checkout",
      {
        p_trip_id: trip.id,
        p_expires_at: checkoutHoldExpiry.toISOString(),
      },
    );

    if (extendError) {
      return json(
        { error: "Booking hold expired", code: "BOOKING_HOLD_EXPIRED" },
        409,
      );
    }

    const { error: priceUpdateError } = await admin
      .from("trips")
      .update({
        total_cents: quote.total_after_tax,
        currency: quote.currency,
        pricing_breakdown: quote,
      })
      .eq("id", trip.id)
      .eq("guest_id", userId)
      .in("status", ["draft", "pending_payment"]);

    if (priceUpdateError) {
      throw new Error("trip_price_snapshot_update_failed");
    }

    const stripe = new Stripe(stripeKey);

    if (trip.stripe_session_id) {
      try {
        const existing = await stripe.checkout.sessions.retrieve(
          trip.stripe_session_id,
        );
        if (existing.status === "open" && existing.url) {
          return json({
            url: existing.url,
            session_id: existing.id,
            reused: true,
          });
        }
      } catch {
        // A missing/expired previous session is replaced below.
      }
    }

    const { data: car } = await admin
      .from("cars")
      .select("make,model,year")
      .eq("id", trip.car_id)
      .maybeSingle();

    const { data: photo } = await admin
      .from("car_photos")
      .select("url")
      .eq("car_id", trip.car_id)
      .order("sort_order")
      .limit(1)
      .maybeSingle();

    const publicAppUrl = Deno.env.get("PUBLIC_APP_URL") || "https://rentauto.ca";
    const canonicalOrigin = new URL(publicAppUrl).origin;
    const extraOrigins = (Deno.env.get("ADDITIONAL_APP_ORIGINS") || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    const allowedOrigins = new Set([canonicalOrigin, ...extraOrigins]);

    function resolveReturnTarget(): string {
      const expectedTripPath = `/trips/${trip.id}`;
      const expectedCheckoutPath = `/checkout/${trip.id}`;

      if (
        returnPath &&
        (returnPath === expectedTripPath || returnPath === expectedCheckoutPath)
      ) {
        return new URL(returnPath, canonicalOrigin).toString();
      }

      if (legacyReturnUrl) {
        try {
          const candidate = new URL(legacyReturnUrl);
          if (
            candidate.protocol === "https:" &&
            allowedOrigins.has(candidate.origin) &&
            (candidate.pathname === expectedTripPath ||
              candidate.pathname === expectedCheckoutPath)
          ) {
            return candidate.toString();
          }
        } catch {
          // Fall through to the canonical route.
        }
      }

      return new URL(expectedTripPath, canonicalOrigin).toString();
    }

    const returnTarget = resolveReturnTarget();
    const success = new URL(returnTarget);
    success.pathname = `/trips/${trip.id}`;
    success.searchParams.set("payment", "success");
    success.searchParams.set("session_id", "{CHECKOUT_SESSION_ID}");

    const cancel = new URL(`/checkout/${trip.id}`, canonicalOrigin);
    cancel.searchParams.set("payment", "cancelled");

    const successUrl = success.toString().replace(
      "%7BCHECKOUT_SESSION_ID%7D",
      "{CHECKOUT_SESSION_ID}",
    );

    const productName = car
      ? `${car.year} ${car.make} ${car.model}`
      : "Rentauto booking";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_creation: "always",
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      line_items: [
        {
          price_data: {
            currency: quote.currency.toLowerCase(),
            unit_amount: quote.total_after_tax,
            product_data: {
              name: productName,
              description: `Trip ${new Date(trip.start_at).toLocaleDateString(
                "en-CA",
              )} – ${new Date(trip.end_at).toLocaleDateString("en-CA")}`,
              images: photo?.url ? [photo.url] : undefined,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        trip_id: trip.id,
        guest_id: userId,
        hold_id: hold.id,
        expected_total_cents: String(quote.total_after_tax),
        currency: quote.currency,
        pricing_version: quote.pricing_version,
      },
      success_url: successUrl,
      cancel_url: cancel.toString(),
    });

    const { error: sessionUpdateError } = await admin
      .from("trips")
      .update({
        stripe_session_id: session.id,
        status: "pending_payment",
        payment_status: "pending",
      })
      .eq("id", trip.id)
      .eq("guest_id", userId)
      .in("status", ["draft", "pending_payment"]);

    if (sessionUpdateError) {
      try {
        await stripe.checkout.sessions.expire(session.id);
      } catch {
        // The DB error is primary; Stripe expiration is best-effort cleanup.
      }
      throw new Error("stripe_session_persistence_failed");
    }

    return json({
      url: session.url,
      session_id: session.id,
      hold_expires_at: checkoutHoldExpiry.toISOString(),
    });
  } catch (cause) {
    console.error(
      "[create-checkout-session] failed",
      cause instanceof Error ? cause.name : "unknown_error",
    );
    return json(
      {
        error: "Payment session could not be created",
        code: "CHECKOUT_SESSION_FAILED",
      },
      500,
    );
  }
});
