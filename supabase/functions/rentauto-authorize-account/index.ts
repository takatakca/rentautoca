import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TERMS_VERSION = "2026-10-03";
const PRIVACY_VERSION = "2026-10-03";

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("[rentauto-authorize-account] Server configuration missing");
    return json({ error: "Service unavailable" }, 503);
  }

  let body: { host_intent?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const hostIntent = body.host_intent === true;
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } =
    await admin.auth.getUser(authHeader.slice(7));

  if (authError || !authData.user) return json({ error: "Unauthorized" }, 401);

  const user = authData.user;
  const acceptedAt = new Date().toISOString();
  const currentAppMetadata = {
    ...(user.app_metadata ?? {}),
  };
  const currentUserMetadata = {
    ...(user.user_metadata ?? {}),
  };

  const firstAuthorizedAt =
    typeof currentAppMetadata.rentauto_authorized_at === "string"
      ? currentAppMetadata.rentauto_authorized_at
      : acceptedAt;

  const { data: updated, error: metadataError } =
    await admin.auth.admin.updateUserById(user.id, {
      app_metadata: {
        ...currentAppMetadata,
        rentauto_authorized_at: firstAuthorizedAt,
        rentauto_terms_accepted_at: acceptedAt,
        rentauto_privacy_accepted_at: acceptedAt,
        rentauto_terms_version: TERMS_VERSION,
        rentauto_privacy_version: PRIVACY_VERSION,
        rentauto_host_intent: hostIntent,
      },
      user_metadata: {
        ...currentUserMetadata,
        source_application: "RENTAUTO",
        host_intent: hostIntent ? "true" : "false",
        rentauto_terms_accepted_at: acceptedAt,
        rentauto_privacy_accepted_at: acceptedAt,
        rentauto_consent_captured_at: acceptedAt,
      },
    });

  if (metadataError || !updated.user) {
    console.error(
      "[rentauto-authorize-account] Could not persist authorization",
      metadataError?.message ?? "missing_updated_user",
    );
    return json(
      {
        error: "Rentauto authorization could not be recorded.",
        code: "RENTAUTO_AUTHORIZATION_WRITE_FAILED",
      },
      500,
    );
  }

  const { data: account, error: bootstrapError } = await admin.rpc(
    "bootstrap_rentauto_account",
    { p_auth_user_id: user.id },
  );

  if (bootstrapError) {
    if (bootstrapError.message?.includes("verified_master_identity_required")) {
      return json(
        {
          error: "A verified TAKATAK email or mobile identity is required.",
          code: "IDENTITY_VERIFICATION_REQUIRED",
        },
        409,
      );
    }

    console.error(
      "[rentauto-authorize-account] Bootstrap failed",
      bootstrapError.code ?? "unknown",
    );
    return json(
      {
        error: "TAKATAK could not authorize Rentauto for this identity.",
        code: "RENTAUTO_BOOTSTRAP_FAILED",
      },
      500,
    );
  }

  return json({
    ok: true,
    account,
    authorization: {
      accepted_at: acceptedAt,
      terms_version: TERMS_VERSION,
      privacy_version: PRIVACY_VERSION,
      host_intent: hostIntent,
    },
  });
});
