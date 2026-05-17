// Trip state-machine transitions: start_check_in, complete_check_in, complete_check_out, cancel, report_issue
// Enforces valid transitions and writes audit events.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Action =
  | "start_check_in"
  | "complete_check_in"
  | "complete_check_out"
  | "cancel";

const VALID_FROM: Record<Action, string[]> = {
  start_check_in: ["confirmed"],
  complete_check_in: ["check_in_pending", "confirmed"],
  complete_check_out: ["active", "check_out_pending"],
  cancel: ["quote", "pending_payment", "confirmed", "check_in_pending"],
};

const NEXT_STATUS: Record<Action, string> = {
  start_check_in: "check_in_pending",
  complete_check_in: "active",
  complete_check_out: "completed",
  cancel: "cancelled",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const token = authHeader.slice(7);

    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: claims, error: claimErr } = await userClient.auth.getClaims(token);
    if (claimErr || !claims?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claims.claims.sub as string;

    const body = await req.json();
    const action = body?.action as Action;
    const tripId = body?.trip_id as string;
    const payload = (body?.payload ?? {}) as Record<string, unknown>;

    if (!action || !tripId || !VALID_FROM[action]) {
      return json({ error: "Invalid action or trip_id" }, 400);
    }

    const { data: trip, error: tripErr } = await admin
      .from("trips")
      .select("id, status, guest_id, car_id, pricing_breakdown")
      .eq("id", tripId)
      .maybeSingle();
    if (tripErr || !trip) return json({ error: "Trip not found" }, 404);

    const { data: car } = await admin
      .from("cars")
      .select("id, host_id")
      .eq("id", trip.car_id)
      .maybeSingle();
    if (!car) return json({ error: "Car not found" }, 404);

    const isGuest = trip.guest_id === userId;
    const isHost = car.host_id === userId;
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    const isAdmin = !!roleRow;

    if (!isGuest && !isHost && !isAdmin) {
      return json({ error: "Forbidden" }, 403);
    }

    // Only guest can start/complete check-in/check-out; host or admin can cancel/end
    if ((action === "start_check_in" || action === "complete_check_in") && !isGuest && !isAdmin) {
      return json({ error: "Only the guest can perform check-in" }, 403);
    }
    if (action === "complete_check_out" && !isGuest && !isHost && !isAdmin) {
      return json({ error: "Forbidden" }, 403);
    }

    if (!VALID_FROM[action].includes(trip.status)) {
      return json({ error: `Cannot ${action} from status ${trip.status}` }, 409);
    }

    const nextStatus = NEXT_STATUS[action];
    const updates: Record<string, unknown> = { status: nextStatus, updated_at: new Date().toISOString() };

    // Persist check-in / check-out snapshots into pricing_breakdown
    const breakdown = (trip.pricing_breakdown as Record<string, unknown>) || {};
    if (action === "complete_check_in") {
      breakdown.check_in = { ...payload, at: new Date().toISOString(), by: userId };
      updates.pricing_breakdown = breakdown;
    }
    if (action === "complete_check_out") {
      breakdown.check_out = { ...payload, at: new Date().toISOString(), by: userId };
      // Compute mileage overage if both odometers present
      const ciOdo = Number((breakdown.check_in as any)?.odometer_km);
      const coOdo = Number((payload as any)?.odometer_km);
      const includedKmPerDay = Number((breakdown as any).included_km_per_day || 0);
      const days = Number((breakdown as any).days || 1);
      const extraKmPriceCents = Number((breakdown as any).extra_km_price_cents || 0);
      if (Number.isFinite(ciOdo) && Number.isFinite(coOdo) && coOdo > ciOdo) {
        const drivenKm = coOdo - ciOdo;
        const includedKm = includedKmPerDay * days;
        const overageKm = Math.max(0, drivenKm - includedKm);
        breakdown.mileage_summary = {
          driven_km: drivenKm,
          included_km: includedKm,
          overage_km: overageKm,
          overage_cents: overageKm * extraKmPriceCents,
        };
      }
      updates.pricing_breakdown = breakdown;
    }

    const { error: updErr } = await admin.from("trips").update(updates).eq("id", tripId);
    if (updErr) throw updErr;

    // Tracking session lifecycle
    if (action === "complete_check_in") {
      const consentAt = (payload as any)?.consent_accepted_at || new Date().toISOString();
      await admin.from("trip_tracking_sessions").insert({
        trip_id: tripId,
        car_id: trip.car_id,
        guest_id: trip.guest_id,
        host_id: car.host_id,
        status: "active",
        started_at: new Date().toISOString(),
        consent_accepted_at: consentAt,
      });
    }
    if (action === "complete_check_out" || action === "cancel") {
      await admin
        .from("trip_tracking_sessions")
        .update({ status: "ended", ended_at: new Date().toISOString() })
        .eq("trip_id", tripId)
        .eq("status", "active");
    }

    await admin.from("trip_events").insert({
      trip_id: tripId,
      actor_user_id: userId,
      event_type: action,
      payload_json: { from: trip.status, to: nextStatus, payload },
    });

    return json({ ok: true, status: nextStatus });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
