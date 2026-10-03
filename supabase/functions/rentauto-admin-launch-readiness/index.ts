import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

type Evidence = { ready: boolean; detail: string };

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

  const publicAppUrl =
    Deno.env.get("RENTAUTO_PUBLIC_APP_URL") ||
    Deno.env.get("PUBLIC_APP_URL") ||
    "";
  let canonicalAppUrl = false;

  try {
    const parsed = new URL(publicAppUrl);
    canonicalAppUrl =
      parsed.protocol === "https:" &&
      (parsed.hostname === "rentauto.ca" || parsed.hostname === "www.rentauto.ca");
  } catch {
    canonicalAppUrl = false;
  }

  const [
    accounts,
    masterLinkedAccounts,
    hostRoles,
    cars,
    activeCars,
    approvedDrivers,
    approvedHosts,
    payoutReadyHosts,
    trackingDevices,
    webhookProcessed,
    webhookFailed,
    paidTrips,
    completedTrips,
    reviews,
    incidents,
    disputes,
  ] = await Promise.all([
    rentauto.from("accounts").select("auth_user_id", { count: "exact", head: true }),
    rentauto.from("accounts").select("auth_user_id", { count: "exact", head: true }).not("master_identity_id", "is", null),
    rentauto.from("account_roles").select("id", { count: "exact", head: true }).eq("role", "host"),
    rentauto.from("cars").select("id", { count: "exact", head: true }),
    rentauto.from("cars").select("id", { count: "exact", head: true }).eq("status", "active"),
    rentauto.from("driver_verifications").select("id", { count: "exact", head: true }).eq("status", "approved"),
    rentauto.from("host_verifications").select("id", { count: "exact", head: true }).eq("verification_status", "approved"),
    rentauto.from("stripe_accounts").select("id", { count: "exact", head: true }).eq("charges_enabled", true).eq("payouts_enabled", true),
    rentauto.from("vehicle_tracking_devices").select("id", { count: "exact", head: true }).eq("status", "active"),
    rentauto.from("stripe_webhook_events").select("id", { count: "exact", head: true }).eq("status", "processed"),
    rentauto.from("stripe_webhook_events").select("id", { count: "exact", head: true }).eq("status", "failed"),
    rentauto.from("trips").select("id", { count: "exact", head: true }).eq("payment_status", "paid"),
    rentauto.from("trips").select("id", { count: "exact", head: true }).eq("status", "completed"),
    rentauto.from("reviews").select("id", { count: "exact", head: true }),
    rentauto.from("trip_incidents").select("id", { count: "exact", head: true }),
    rentauto.from("stripe_webhook_events").select("id", { count: "exact", head: true }).like("event_type", "charge.dispute.%"),
  ]);

  const count = (result: { count: number | null; error: unknown }) =>
    result.error ? 0 : result.count ?? 0;

  const counts = {
    accounts: count(accounts),
    master_linked_accounts: count(masterLinkedAccounts),
    host_roles: count(hostRoles),
    cars: count(cars),
    active_cars: count(activeCars),
    approved_driver_verifications: count(approvedDrivers),
    approved_host_verifications: count(approvedHosts),
    payout_ready_hosts: count(payoutReadyHosts),
    active_tracking_devices: count(trackingDevices),
    processed_stripe_webhooks: count(webhookProcessed),
    failed_stripe_webhooks: count(webhookFailed),
    paid_trips: count(paidTrips),
    completed_trips: count(completedTrips),
    reviews: count(reviews),
    incidents: count(incidents),
    dispute_events: count(disputes),
  };

  const stripeSecretConfigured = Boolean(Deno.env.get("STRIPE_SECRET_KEY"));
  const stripeWebhookConfigured = Boolean(Deno.env.get("STRIPE_WEBHOOK_SECRET"));
  const trackingSecretConfigured = Boolean(
    Deno.env.get("RENTAUTO_TRACKING_PROVIDER_SECRET"),
  );

  const evidence: Record<string, Evidence> = {
    "public-app-url": {
      ready: canonicalAppUrl,
      detail: canonicalAppUrl
        ? "Canonical HTTPS app URL resolves to rentauto.ca."
        : "RENTAUTO_PUBLIC_APP_URL/PUBLIC_APP_URL is missing or non-canonical.",
    },
    "stripe-secret": {
      ready: stripeSecretConfigured,
      detail: stripeSecretConfigured
        ? "Stripe server secret is configured."
        : "Stripe server secret is not available to Edge Functions.",
    },
    "stripe-webhook-secret": {
      ready: stripeWebhookConfigured,
      detail: stripeWebhookConfigured
        ? "Stripe webhook signing secret is configured."
        : "Stripe webhook signing secret is not available.",
    },
    "tracking-secret": {
      ready: trackingSecretConfigured,
      detail: trackingSecretConfigured
        ? "Tracking provider secret is configured."
        : "Tracking provider secret is not configured.",
    },
    "takatak-master-identity": {
      ready: counts.master_linked_accounts > 0,
      detail: counts.master_linked_accounts > 0
        ? `${counts.master_linked_accounts} Rentauto account(s) linked to TAKATAK master identity.`
        : "No Rentauto account is linked to a TAKATAK master identity yet.",
    },
    "host-signup": {
      ready: counts.host_roles > 0,
      detail: `${counts.host_roles} host role(s) currently exist.`,
    },
    "host-connect": {
      ready: counts.payout_ready_hosts > 0,
      detail: `${counts.payout_ready_hosts} Stripe Connect account(s) have charges and payouts enabled.`,
    },
    "host-car": {
      ready: counts.cars > 0,
      detail: `${counts.cars} vehicle listing(s) exist.`,
    },
    "host-published": {
      ready: counts.active_cars > 0,
      detail: `${counts.active_cars} vehicle listing(s) are active.`,
    },
    "guest-signup": {
      ready: counts.accounts > 1,
      detail: `${counts.accounts} Rentauto account(s) exist.`,
    },
    "guest-profile": {
      ready: counts.approved_driver_verifications > 0,
      detail: `${counts.approved_driver_verifications} driver verification(s) are approved.`,
    },
    "stripe-webhook-events": {
      ready: counts.processed_stripe_webhooks > 0,
      detail: `${counts.processed_stripe_webhooks} processed Stripe webhook event(s); ${counts.failed_stripe_webhooks} failed.`,
    },
    "checkout-success": {
      ready: counts.paid_trips > 0,
      detail: `${counts.paid_trips} paid trip(s) are recorded.`,
    },
    "device-registered": {
      ready: counts.active_tracking_devices > 0,
      detail: `${counts.active_tracking_devices} active tracking device(s) are registered.`,
    },
    "review-submitted": {
      ready: counts.reviews > 0,
      detail: `${counts.reviews} review(s) exist.`,
    },
    incident: {
      ready: counts.incidents > 0,
      detail: `${counts.incidents} incident report(s) exist.`,
    },
    dispute: {
      ready: counts.dispute_events > 0,
      detail: `${counts.dispute_events} Stripe dispute event(s) are recorded.`,
    },
  };

  return json({
    generated_at: new Date().toISOString(),
    counts,
    evidence,
  });
});
