import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@17?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return new Response(
        JSON.stringify({ error: "PAYMENT_NOT_CONFIGURED", message: "Payment provider is not configured." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub as string;

    const { tripId, returnUrl } = await req.json();
    if (!tripId) {
      return new Response(JSON.stringify({ error: "tripId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: trip } = await admin
      .from("trips")
      .select("id, guest_id, car_id, start_at, end_at, status, total_cents, currency, pricing_breakdown")
      .eq("id", tripId)
      .single();

    if (!trip || trip.guest_id !== userId) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["draft", "pending_payment"].includes(trip.status)) {
      return new Response(JSON.stringify({ error: "Trip cannot be paid in current status" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Re-check availability
    const { data: blocks } = await admin
      .from("availability_blocks")
      .select("id")
      .eq("car_id", trip.car_id)
      .neq("type", "booking_self")
      .lt("start_at", trip.end_at)
      .gt("end_at", trip.start_at)
      .limit(1);
    if (blocks && blocks.length > 0) {
      return new Response(JSON.stringify({ error: "Dates no longer available" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: car } = await admin
      .from("cars")
      .select("title, make, model, year")
      .eq("id", trip.car_id)
      .single();

    const { data: photo } = await admin
      .from("car_photos")
      .select("url")
      .eq("car_id", trip.car_id)
      .order("sort_order")
      .limit(1)
      .maybeSingle();

    const stripe = new Stripe(stripeKey);
    const origin = req.headers.get("origin") || Deno.env.get("PUBLIC_APP_URL") || "https://rentautoca.lovable.app";
    const successUrl = returnUrl
      ? `${returnUrl}?payment=success&session_id={CHECKOUT_SESSION_ID}`
      : `${origin}/trips/${trip.id}?payment=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = returnUrl
      ? `${returnUrl}?payment=cancelled`
      : `${origin}/checkout/${trip.id}?payment=cancelled`;

    const productName = car ? `${car.year} ${car.make} ${car.model}` : "Rentauto booking";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_creation: "always",
      line_items: [
        {
          price_data: {
            currency: (trip.currency || "CAD").toLowerCase(),
            unit_amount: trip.total_cents || 0,
            product_data: {
              name: productName,
              description: `Trip ${new Date(trip.start_at).toLocaleDateString()} – ${new Date(trip.end_at).toLocaleDateString()}`,
              images: photo?.url ? [photo.url] : undefined,
            },
          },
          quantity: 1,
        },
      ],
      metadata: { trip_id: trip.id, guest_id: userId },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    await admin
      .from("trips")
      .update({
        stripe_session_id: session.id,
        status: "pending_payment",
        payment_status: "pending",
      })
      .eq("id", trip.id);

    return new Response(JSON.stringify({ url: session.url, session_id: session.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("create-checkout-session error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
