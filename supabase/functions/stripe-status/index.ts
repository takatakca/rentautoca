import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@17?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    // Fetch stripe account from DB
    const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: account } = await supabaseAdmin
      .from("stripe_accounts")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (!account || !account.stripe_account_id) {
      return new Response(
        JSON.stringify({
          stripe_account_id: null,
          charges_enabled: false,
          payouts_enabled: false,
          onboarding_status: "not_started",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fetch live status from Stripe
    const stripe = new Stripe(stripeKey);
    let stripeAccount;
    try {
      stripeAccount = await stripe.accounts.retrieve(account.stripe_account_id);
    } catch {
      return new Response(
        JSON.stringify({
          stripe_account_id: account.stripe_account_id,
          charges_enabled: account.charges_enabled,
          payouts_enabled: account.payouts_enabled,
          onboarding_status: "error",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Sync DB with live Stripe data
    const chargesEnabled = stripeAccount.charges_enabled ?? false;
    const payoutsEnabled = stripeAccount.payouts_enabled ?? false;
    const isComplete = chargesEnabled && payoutsEnabled;

    if (
      account.charges_enabled !== chargesEnabled ||
      account.payouts_enabled !== payoutsEnabled
    ) {
      await supabaseAdmin
        .from("stripe_accounts")
        .update({
          charges_enabled: chargesEnabled,
          payouts_enabled: payoutsEnabled,
          onboarded_at: isComplete && !account.onboarded_at ? new Date().toISOString() : account.onboarded_at,
        })
        .eq("user_id", userId);
    }

    let onboardingStatus = "not_started";
    if (isComplete) {
      onboardingStatus = "complete";
    } else if (account.stripe_account_id) {
      onboardingStatus = "pending";
    }

    return new Response(
      JSON.stringify({
        stripe_account_id: account.stripe_account_id,
        charges_enabled: chargesEnabled,
        payouts_enabled: payoutsEnabled,
        onboarding_status: onboardingStatus,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("stripe-status error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
