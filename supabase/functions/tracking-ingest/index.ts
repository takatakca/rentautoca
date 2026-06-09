// Tracking ingest endpoint — receives GPS location events from provider webhooks.
// Public endpoint (no JWT) — authenticated via x-provider-secret header.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-provider-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface IngestPayload {
  provider: string;
  device_identifier: string;
  lat: number;
  lng: number;
  speed_kmh?: number;
  heading?: number;
  accuracy_meters?: number;
  recorded_at?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validate provider secret (skip in dev if not configured to allow mock)
    const expectedSecret = Deno.env.get("TRACKING_PROVIDER_SECRET");
    const providedSecret = req.headers.get("x-provider-secret");
    if (expectedSecret && providedSecret !== expectedSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Reject oversized payloads (defense vs. flood / amplification)
    const contentLength = Number(req.headers.get("content-length") || "0");
    if (contentLength > 2048) {
      return new Response(JSON.stringify({ error: "Payload too large" }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const raw = await req.text();
    if (raw.length > 2048) {
      return new Response(JSON.stringify({ error: "Payload too large" }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const body = JSON.parse(raw) as IngestPayload;

    const validCoords =
      typeof body?.lat === "number" && typeof body?.lng === "number" &&
      body.lat >= -90 && body.lat <= 90 && body.lng >= -180 && body.lng <= 180;
    const validSpeed = body.speed_kmh == null || (typeof body.speed_kmh === "number" && body.speed_kmh >= 0 && body.speed_kmh < 400);
    const validAcc = body.accuracy_meters == null || (typeof body.accuracy_meters === "number" && body.accuracy_meters >= 0 && body.accuracy_meters < 100000);

    if (!body?.device_identifier || typeof body.device_identifier !== "string" || body.device_identifier.length > 128 || !validCoords || !validSpeed || !validAcc) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Resolve device → car
    const { data: device } = await admin
      .from("vehicle_tracking_devices")
      .select("id, car_id, status")
      .eq("provider", body.provider || "mock")
      .eq("device_identifier", body.device_identifier)
      .maybeSingle();

    if (!device) {
      return new Response(JSON.stringify({ error: "Device not registered" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find active session for that car
    const { data: session } = await admin
      .from("trip_tracking_sessions")
      .select("id, trip_id")
      .eq("car_id", device.car_id)
      .eq("status", "active")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!session) {
      // No active trip — bump last_seen but drop the location event (privacy)
      await admin
        .from("vehicle_tracking_devices")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", device.id);
      return new Response(JSON.stringify({ ok: true, recorded: false, reason: "no_active_session" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const recordedAt = body.recorded_at || new Date().toISOString();
    const { error: insErr } = await admin.from("vehicle_location_events").insert({
      trip_id: session.trip_id,
      car_id: device.car_id,
      lat: body.lat,
      lng: body.lng,
      speed_kmh: body.speed_kmh ?? null,
      heading: body.heading ?? null,
      accuracy_meters: body.accuracy_meters ?? null,
      source: body.provider || "mock",
      recorded_at: recordedAt,
    });
    if (insErr) throw insErr;

    await admin
      .from("vehicle_tracking_devices")
      .update({ last_seen_at: recordedAt })
      .eq("id", device.id);

    return new Response(JSON.stringify({ ok: true, recorded: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
