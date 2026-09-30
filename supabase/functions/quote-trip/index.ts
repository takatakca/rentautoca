import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { buildTripQuote, TripQuoteError } from "../_shared/pricing.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function messageFor(code: string): string {
  switch (code) {
    case "DATES_NOT_AVAILABLE":
    case "DATES_TEMPORARILY_HELD":
      return "Dates not available";
    case "VEHICLE_NOT_FOUND":
      return "Car not found";
    case "VEHICLE_NOT_AVAILABLE":
      return "Vehicle is not available";
    case "INVALID_TRIP_DATES":
      return "Trip dates are invalid";
    case "TRIP_DURATION_TOO_LONG":
      return "Trip duration is too long";
    case "INVALID_EXTRA_SELECTION":
      return "One or more extras are unavailable";
    case "INVALID_PROTECTION_PLAN":
      return "Protection plan is unavailable";
    default:
      return code.startsWith("INVALID_")
        ? "Quote request is invalid"
        : "Unable to calculate quote";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const carId = typeof body?.carId === "string" ? body.carId : "";
    const startAt = typeof body?.startAt === "string" ? body.startAt : "";
    const endAt = typeof body?.endAt === "string" ? body.endAt : "";
    const selectedExtras = Array.isArray(body?.selectedExtras)
      ? body.selectedExtras
      : [];
    const protectionPlanId =
      typeof body?.protectionPlanId === "string" ? body.protectionPlanId : null;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const quote = await buildTripQuote(admin, {
      carId,
      startAt,
      endAt,
      selectedExtras,
      protectionPlanId,
    });

    return new Response(JSON.stringify(quote), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (cause) {
    if (cause instanceof TripQuoteError) {
      return new Response(
        JSON.stringify({ error: messageFor(cause.code), code: cause.code }),
        {
          status: cause.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.error("[quote-trip] Quote calculation failed");
    return new Response(
      JSON.stringify({ error: "Unable to calculate quote", code: "QUOTE_FAILED" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
