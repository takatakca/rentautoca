import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

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

type IncidentRow = {
  id: string;
  trip_id: string;
  reporter_user_id: string;
  type: string;
  description: string | null;
  photo_urls: string[];
  severity: string;
  status: string;
  resolution_code: string | null;
  resolution_notes: string | null;
  resolved_amount_cents: number | null;
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  evidence_hash: string | null;
  created_at: string;
  updated_at: string;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json({ error: "Service unavailable" }, 503);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } =
    await admin.auth.getUser(authHeader.slice(7));
  if (authError || !authData.user) return json({ error: "Unauthorized" }, 401);

  const rentauto = admin.schema("rentauto");
  const { data: adminRole } = await rentauto
    .from("account_roles")
    .select("id")
    .eq("auth_user_id", authData.user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (!adminRole) return json({ error: "Forbidden" }, 403);

  let body: Record<string, unknown> = {};
  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > 12_000) {
      return json({ error: "Request too large" }, 413);
    }
    body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  const action = typeof body.action === "string" ? body.action : "list";

  if (action === "review") {
    const incidentId = typeof body.incidentId === "string" ? body.incidentId : "";
    const nextStatus =
      body.status === "reviewing" || body.status === "resolved" || body.status === "closed"
        ? body.status
        : "";
    const resolutionCode =
      typeof body.resolutionCode === "string"
        ? body.resolutionCode.trim().slice(0, 100)
        : null;
    const resolutionNotes =
      typeof body.resolutionNotes === "string"
        ? body.resolutionNotes.trim().slice(0, 4000)
        : null;
    const rawAmount =
      typeof body.resolvedAmountCents === "number"
        ? body.resolvedAmountCents
        : body.resolvedAmountCents === null || body.resolvedAmountCents === undefined
          ? null
          : Number(body.resolvedAmountCents);
    const resolvedAmountCents =
      rawAmount === null
        ? null
        : Number.isSafeInteger(rawAmount) && rawAmount >= 0 && rawAmount <= 10_000_000
          ? rawAmount
          : Number.NaN;

    if (!UUID.test(incidentId) || !nextStatus || Number.isNaN(resolvedAmountCents)) {
      return json({ error: "Invalid incident review request" }, 400);
    }

    if (
      (nextStatus === "resolved" || nextStatus === "closed") &&
      (!resolutionCode || !resolutionNotes || resolutionNotes.length < 10)
    ) {
      return json(
        { error: "Resolution code and review notes are required to resolve a claim." },
        400,
      );
    }

    const { data: incident, error: incidentError } = await rentauto
      .from("trip_incidents")
      .select("id,trip_id,reporter_user_id,type,status,severity")
      .eq("id", incidentId)
      .maybeSingle();

    if (incidentError) return json({ error: "Could not load incident." }, 500);
    if (!incident) return json({ error: "Incident not found." }, 404);
    if (incident.status === "closed") {
      return json({ error: "Closed incidents cannot be modified." }, 409);
    }

    const update = {
      status: nextStatus,
      resolution_code: resolutionCode,
      resolution_notes: resolutionNotes,
      resolved_amount_cents: resolvedAmountCents,
      reviewed_by_user_id: authData.user.id,
      reviewed_at: new Date().toISOString(),
    };

    const { error: updateError } = await rentauto
      .from("trip_incidents")
      .update(update)
      .eq("id", incidentId)
      .neq("status", "closed");

    if (updateError) {
      console.error("[rentauto-admin-trip-incidents] update failed", updateError.code ?? "unknown");
      return json({ error: "Could not save incident review." }, 500);
    }

    await rentauto.from("trip_incident_events").insert({
      incident_id: incidentId,
      actor_user_id: authData.user.id,
      event_type: `incident_${nextStatus}`,
      payload_json: {
        resolutionCode,
        resolutionNotes,
        resolvedAmountCents,
      },
    });

    const { data: trip } = await rentauto
      .from("trips")
      .select("id,guest_id,car_id,booking_reference")
      .eq("id", incident.trip_id)
      .maybeSingle();

    if (trip) {
      const { data: car } = await rentauto
        .from("cars")
        .select("host_id")
        .eq("id", trip.car_id)
        .maybeSingle();

      const recipients = [...new Set([trip.guest_id, car?.host_id].filter(Boolean))];
      if (recipients.length > 0) {
        const title =
          nextStatus === "reviewing"
            ? "Trip issue under review"
            : nextStatus === "resolved"
              ? "Trip issue resolved"
              : "Trip issue closed";
        const message =
          nextStatus === "reviewing"
            ? "The Rentauto team is reviewing the reported trip issue."
            : resolutionNotes || "The Rentauto team updated the reported trip issue.";

        await rentauto.from("notifications").insert(
          recipients.map((userId) => ({
            user_id: userId,
            type: "trip_incident_review",
            title,
            body: message,
            link: `/trips/${trip.id}`,
            payload: {
              tripId: trip.id,
              incidentId,
              status: nextStatus,
              resolutionCode,
              resolvedAmountCents,
            },
          })),
        );
      }
    }

    return json({ ok: true, incidentId, status: nextStatus });
  }

  if (action !== "list") return json({ error: "Invalid action" }, 400);

  const requestedStatus = typeof body.status === "string" ? body.status : "open";
  const status = ["open", "reviewing", "resolved", "closed", "all"].includes(requestedStatus)
    ? requestedStatus
    : "open";

  let query = rentauto
    .from("trip_incidents")
    .select(
      "id,trip_id,reporter_user_id,type,description,photo_urls,severity,status,resolution_code,resolution_notes,resolved_amount_cents,reviewed_by_user_id,reviewed_at,evidence_hash,created_at,updated_at",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (status !== "all") query = query.eq("status", status);

  const { data: rows, error: rowsError } = await query;
  if (rowsError) return json({ error: "Could not load incidents." }, 500);

  const incidents = (rows ?? []) as IncidentRow[];
  const tripIds = [...new Set(incidents.map((incident) => incident.trip_id))];
  const tripsById = new Map<string, Record<string, unknown>>();
  const carsById = new Map<string, Record<string, unknown>>();

  if (tripIds.length > 0) {
    const { data: trips } = await rentauto
      .from("trips")
      .select("id,guest_id,car_id,booking_reference,status,start_at,end_at")
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

  const userIds = new Set<string>();
  for (const incident of incidents) {
    userIds.add(incident.reporter_user_id);
    const trip = tripsById.get(incident.trip_id);
    const guestId = typeof trip?.guest_id === "string" ? trip.guest_id : null;
    const carId = typeof trip?.car_id === "string" ? trip.car_id : null;
    const car = carId ? carsById.get(carId) : null;
    const hostId = typeof car?.host_id === "string" ? car.host_id : null;
    if (guestId) userIds.add(guestId);
    if (hostId) userIds.add(hostId);
  }

  const profilesByUser = new Map<string, { displayName: string | null; email: string | null }>();
  if (userIds.size > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("authUserId,displayName,email")
      .in("authUserId", [...userIds]);
    for (const profile of profiles ?? []) {
      profilesByUser.set(profile.authUserId, {
        displayName: profile.displayName,
        email: profile.email,
      });
    }
  }

  const result = await Promise.all(
    incidents.map(async (incident) => {
      const trip = tripsById.get(incident.trip_id);
      const carId = typeof trip?.car_id === "string" ? trip.car_id : null;
      const car = carId ? carsById.get(carId) : null;
      const signedPhotos = await Promise.all(
        (incident.photo_urls ?? []).slice(0, 20).map(async (path) => {
          const { data } = await admin.storage
            .from("rentauto-trip-photos")
            .createSignedUrl(path, 600);
          return data?.signedUrl ?? null;
        }),
      );

      return {
        id: incident.id,
        tripId: incident.trip_id,
        bookingReference:
          typeof trip?.booking_reference === "string" ? trip.booking_reference : null,
        tripStatus: typeof trip?.status === "string" ? trip.status : null,
        reporterUserId: incident.reporter_user_id,
        reporter: profilesByUser.get(incident.reporter_user_id) ?? {
          displayName: null,
          email: null,
        },
        type: incident.type,
        description: incident.description,
        severity: incident.severity,
        status: incident.status,
        resolutionCode: incident.resolution_code,
        resolutionNotes: incident.resolution_notes,
        resolvedAmountCents: incident.resolved_amount_cents,
        reviewedAt: incident.reviewed_at,
        evidenceHash: incident.evidence_hash,
        createdAt: incident.created_at,
        vehicle: car
          ? {
              id: car.id,
              title: car.title,
              year: car.year,
              make: car.make,
              model: car.model,
              hostId: car.host_id,
              host: profilesByUser.get(String(car.host_id)) ?? {
                displayName: null,
                email: null,
              },
            }
          : null,
        photoUrls: signedPhotos.filter((url): url is string => Boolean(url)),
      };
    }),
  );

  return json({ incidents: result });
});