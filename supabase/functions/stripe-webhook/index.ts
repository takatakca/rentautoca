import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@17?target=deno";

Deno.serve(async (req) => {
  // Webhooks are POST only
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not configured");
    if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET not configured");

    const stripe = new Stripe(stripeKey);
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return new Response(JSON.stringify({ error: "Missing stripe-signature" }), {
        status: 400,
      });
    }

    // Verify signature
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 400,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Idempotency: check if we've already processed this event
    const { data: existingEvent } = await supabase
      .from("stripe_webhook_events")
      .select("id")
      .eq("stripe_event_id", event.id)
      .single();

    if (existingEvent) {
      console.log(`Event ${event.id} already processed, skipping.`);
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        status: 200,
      });
    }

    // Store event for idempotency
    await supabase.from("stripe_webhook_events").insert({
      stripe_event_id: event.id,
      event_type: event.type,
    });

    // Handle event types
    switch (event.type) {
      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        const chargesEnabled = account.charges_enabled ?? false;
        const payoutsEnabled = account.payouts_enabled ?? false;
        const isComplete = chargesEnabled && payoutsEnabled;

        const { data: existingRow } = await supabase
          .from("stripe_accounts")
          .select("onboarded_at")
          .eq("stripe_account_id", account.id)
          .single();

        await supabase
          .from("stripe_accounts")
          .update({
            charges_enabled: chargesEnabled,
            payouts_enabled: payoutsEnabled,
            onboarded_at:
              isComplete && !existingRow?.onboarded_at
                ? new Date().toISOString()
                : existingRow?.onboarded_at ?? null,
          })
          .eq("stripe_account_id", account.id);

        console.log(
          `account.updated: ${account.id} charges=${chargesEnabled} payouts=${payoutsEnabled}`
        );
        break;
      }

      case "account.application.deauthorized": {
        const account = event.data.object as Stripe.Account;
        await supabase
          .from("stripe_accounts")
          .update({
            stripe_account_id: null,
            charges_enabled: false,
            payouts_enabled: false,
            onboarded_at: null,
          })
          .eq("stripe_account_id", account.id);

        console.log(`account.application.deauthorized: ${account.id}`);
        break;
      }

      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        console.log(`payment_intent.succeeded: ${pi.id} amount=${pi.amount}`);
        // TODO Phase 4: update booking payment status
        break;
      }

      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        console.log(
          `payment_intent.payment_failed: ${pi.id} error=${pi.last_payment_error?.message}`
        );
        // TODO Phase 4: update booking payment status
        break;
      }

      case "charge.dispute.created": {
        const dispute = event.data.object as Stripe.Dispute;
        console.log(
          `charge.dispute.created: ${dispute.id} amount=${dispute.amount} reason=${dispute.reason}`
        );
        // TODO Phase 5: flag booking/trip for admin review
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (error: unknown) {
    console.error("stripe-webhook error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
});
