import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "rentauto-driver-documents";
const DATE = /^\d{4}-\d{2}-\d{2}$/;

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

function safePath(value: unknown, userId: string, kind: string): string | null {
  if (typeof value !== "string" || value.length > 600) return null;
  const prefix = `${userId}/${kind}/`;
  if (!value.startsWith(prefix) || value.includes("..")) return null;
  const file = value.slice(prefix.length);
  if (!file || file.includes("/")) return null;
  return value;
}

async function objectExists(
  admin: ReturnType<typeof createClient>,
  path: string,
): Promise<boolean> {
  const parts = path.split("/");
  const file = parts.pop();
  const folder = parts.join("/");
  if (!file) return false;

  const { data, error } = await admin.storage
    .from(BUCKET)
    .list(folder, { limit: 100, search: file });

  return !error && (data ?? []).some((row) => row.name === file);
}

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

  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > 12_000) {
      return json({ error: "Request too large" }, 413);
    }
    body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  const rentauto = admin.schema("rentauto");
  const action = typeof body.action === "string" ? body.action : "status";

  if (action === "status") {
    const { data, error } = await rentauto
      .from("driver_verifications")
      .select(
        "id,status,license_region,license_country,license_expires_on,license_front_url,license_back_url,selfie_url,reviewer_notes,submitted_at,reviewed_at,updated_at",
      )
      .eq("user_id", authData.user.id)
      .maybeSingle();

    if (error) return json({ error: "Could not load driver verification." }, 500);

    const today = new Date().toISOString().slice(0, 10);
    const effectiveStatus =
      data?.status === "approved" &&
      (!data.license_expires_on || data.license_expires_on < today)
        ? "expired"
        : data?.status;

    return json({
      verification: data
        ? {
            id: data.id,
            status: effectiveStatus,
            licenseRegion: data.license_region,
            licenseCountry: data.license_country,
            licenseExpiresOn: data.license_expires_on,
            hasLicenseFront: Boolean(data.license_front_url),
            hasLicenseBack: Boolean(data.license_back_url),
            hasSelfie: Boolean(data.selfie_url),
            reviewerNotes: data.reviewer_notes,
            submittedAt: data.submitted_at,
            reviewedAt: data.reviewed_at,
            updatedAt: data.updated_at,
          }
        : null,
    });
  }

  if (action !== "submit") return json({ error: "Invalid action" }, 400);

  const licenseRegion =
    typeof body.licenseRegion === "string" ? body.licenseRegion.trim().toUpperCase() : "";
  const licenseCountry =
    typeof body.licenseCountry === "string" ? body.licenseCountry.trim().toUpperCase() : "CA";
  const licenseExpiresOn =
    typeof body.licenseExpiresOn === "string" ? body.licenseExpiresOn : "";
  const licenseFrontPath = safePath(
    body.licenseFrontPath,
    authData.user.id,
    "license_front",
  );
  const licenseBackPath = safePath(
    body.licenseBackPath,
    authData.user.id,
    "license_back",
  );
  const selfiePath = safePath(body.selfiePath, authData.user.id, "selfie");

  if (
    !licenseFrontPath ||
    !licenseBackPath ||
    !selfiePath ||
    licenseRegion.length < 2 ||
    licenseRegion.length > 64 ||
    !/^[A-Z]{2}$/.test(licenseCountry) ||
    !DATE.test(licenseExpiresOn)
  ) {
    return json({ error: "Invalid verification submission", code: "INVALID_REQUEST" }, 400);
  }

  const expiresAt = new Date(`${licenseExpiresOn}T23:59:59Z`);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
    return json({ error: "Driver licence is expired", code: "LICENSE_EXPIRED" }, 409);
  }

  const [frontExists, backExists, selfieExists] = await Promise.all([
    objectExists(admin, licenseFrontPath),
    objectExists(admin, licenseBackPath),
    objectExists(admin, selfiePath),
  ]);

  if (!frontExists || !backExists || !selfieExists) {
    return json({ error: "Uploaded documents could not be verified", code: "DOCUMENT_MISSING" }, 409);
  }

  const { data: existing, error: existingError } = await rentauto
    .from("driver_verifications")
    .select("id,status,license_expires_on")
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (existingError) return json({ error: "Could not load driver verification." }, 500);

  const today = new Date().toISOString().slice(0, 10);
  if (
    existing?.status === "approved" &&
    existing.license_expires_on &&
    existing.license_expires_on >= today
  ) {
    return json(
      { error: "Driver verification is already approved", code: "ALREADY_APPROVED" },
      409,
    );
  }

  const submission = {
    user_id: authData.user.id,
    license_front_url: licenseFrontPath,
    license_back_url: licenseBackPath,
    selfie_url: selfiePath,
    license_country: licenseCountry,
    license_region: licenseRegion,
    license_expires_on: licenseExpiresOn,
    status: "pending",
    reviewer_notes: null,
    reviewer_user_id: null,
    submitted_at: new Date().toISOString(),
    reviewed_at: null,
  };

  const { data, error } = existing
    ? await rentauto
        .from("driver_verifications")
        .update(submission)
        .eq("id", existing.id)
        .select("id,status,submitted_at")
        .single()
    : await rentauto
        .from("driver_verifications")
        .insert(submission)
        .select("id,status,submitted_at")
        .single();

  if (error) {
    console.error("[rentauto-driver-verification] submit failed", error.code ?? "unknown");
    return json({ error: "Could not submit driver verification." }, 500);
  }

  return json({ ok: true, verification: data }, 201);
});
