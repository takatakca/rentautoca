import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@17?target=deno";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!stripeKey || !webhookSecret || !supabaseUrl || !serviceKey) {
    console.error("[stripe-webhook] Required server configuration missing");
    return json({ error: "Webhook unavailable" }, 503);
  }

  const stripe = new Stripe(stripeKey);
  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return json({ error: "Missing signature" }, 400);
  }

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      webhookSecret,
    );
  } catch {
    console.error("[stripe-webhook] Signature verification failed");
    return json({ error: "Invalid signature" }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: claimRows, error: claimError } = await admin.rpc(
    "claim_stripe_webhook_event",
    {
      p_event_id: event.id,
      p_event_type: event.type,
    },
  );

  if (claimError) {
    console.error("[stripe-webhook] Could not claim event", event.id);
    return json({ error: "Webhook processing unavailable" }, 500);
  }

  const claim = Array.isArray(claimRows) ? claimRows[0] : null;
  if (!claim?.should_process) {
    if (claim?.current_status === "processed") {
      return json({ received: true, duplicate: true }, 200);
    }
    return json({ error: "Event is already processing" }, 503);
  }

  try {
    switch (event.type) {
      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        const chargesEnabled = account.charges_enabled ?? false;
        const payoutsEnabled = account.payouts_enabled ?? false;
        const isComplete = chargesEnabled && payoutsEnabled;

        const { data: existing } = await admin
          .from("stripe_accounts")
          .select("onboarded_at")
          .eq("stripe_account_id", account.id)
          .maybeSingle();

        const { error } = await admin
          .from("stripe_accounts")
          .update({
            charges_enabled: chargesEnabled,
            payouts_enabled: payoutsEnabled,
            onboarded_at:
              isComplete && !existing?.onboarded_at
                ? new Date().toISOString()
                : existing?.onboarded_at ?? null,
          })
          .eq("stripe_account_id", account.id);

        if (error) throw new Error("stripe_account_update_failed");
        break;
      }

      case "account.application.deauthorized": {
        const account = event.data.object as Stripe.Account;
        const { error } = await admin
          .from("stripe_accounts")
          .update({
            stripe_account_id: null,
            charges_enabled: false,
            payouts_enabled: false,
            onboarded_at: null,
          })
          .eq("stripe_account_id", account.id);

        if (error) throw new Error("stripe_account_deauthorization_failed");
        break;
      }

      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const tripId = session.metadata?.trip_id;
        const metadataGuestId = session.metadata?.guest_id;
        const amountTotal = session.amount_total;
        const currency = session.currency?.toUpperCase();

        if (
          !tripId ||
          !metadataGuestId ||
          session.payment_status !== "paid" ||
          typeof amountTotal !== "number" ||
          !currency
        ) {
          throw new Error("invalid_completed_checkout_session");
        }

        const expectedAmount = Number(session.metadata?.expected_total_cents);
        const expectedCurrency = session.metadata?.currency?.toUpperCase();

        if (
          !Number.isSafeInteger(expectedAmount) ||
          expectedAmount !== amountTotal ||
          expectedCurrency !== currency
        ) {
          throw new Error("stripe_metadata_amount_mismatch");
        }

        const { data: trip, error: tripLookupError } = await admin
          .from("trips")
          .select("id,guest_id,stripe_session_id")
          .eq("id", tripId)
          .maybeSingle();

        if (
          tripLookupError ||
          !trip ||
          trip.guest_id !== metadataGuestId ||
          trip.stripe_session_id !== session.id
        ) {
          throw new Error("stripe_trip_binding_mismatch");
        }

        const paymentIntentId =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : null;

        if (!paymentIntentId) {
          throw new Error("payment_intent_missing");
        }

        const { error: finalizeError } = await admin.rpc(
          "finalize_paid_booking",
          {
            p_trip_id: tripId,
            p_stripe_session_id: session.id,
            p_payment_intent_id: paymentIntentId,
            p_amount_total: amountTotal,
            p_currency: currency,
            p_event_created_at: new Date(event.created * 1000).toISOString(),
          },
        );

        if (finalizeError) {
          console.error(
            "[stripe-webhook] Booking finalization failed",
            finalizeError.code ?? "unknown",
          );
          throw new Error("booking_finalization_failed");
        }
        break;
      }

      case "checkout.session.expired":
      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const tripId = session.metadata?.trip_id;

        if (tripId) {
          const { data: currentTrip } = await admin
            .from("trips")
            .select("id,stripe_session_id,status")
            .eq("id", tripId)
            .maybeSingle();

          if (
            currentTrip?.stripe_session_id === session.id &&
            currentTrip.status === "pending_payment"
          ) {
            const { error: tripUpdateError } = await admin
              .from("trips")
              .update({
                status: "cancelled",
                payment_status: "failed",
              })
              .eq("id", tripId)
              .eq("stripe_session_id", session.id)
              .eq("status", "pending_payment");

            if (tripUpdateError) {
              throw new Error("expired_checkout_trip_update_failed");
            }

            const { error: holdUpdateError } = await admin
              .from("booking_holds")
              .update({
                status: "released",
                updated_at: new Date().toISOString(),
              })
              .eq("trip_id", tripId)
              .eq("status", "active");

            if (holdUpdateError) {
              throw new Error("expired_checkout_hold_release_failed");
            }

            await admin.from("trip_events").insert({
              trip_id: tripId,
              actor_user_id: null,
              event_type: "checkout_expired",
              payload_json: {
                stripe_session_id: session.id,
                event_type: event.type,
              },
            });
          }
        }
        break;
      }

      case "charge.dispute.created": {
        const dispute = event.data.object as Stripe.Dispute;
        const paymentIntentId =
          typeof dispute.payment_intent === "string"
            ? dispute.payment_intent
            : null;

        if (paymentIntentId) {
          const { data: trip } = await admin
            .from("trips")
            .select("id")
            .eq("stripe_payment_intent_id", paymentIntentId)
            .maybeSingle();

          if (trip) {
            await admin.from("trip_events").insert({
              trip_id: trip.id,
              actor_user_id: null,
              event_type: "charge_dispute_created",
              payload_json: {
                dispute_id: dispute.id,
                amount: dispute.amount,
                reason: dispute.reason,
              },
            });
          }
        }
        break;
      }

      case "payment_intent.succeeded":
      case "payment_intent.payment_failed":
        // Checkout session events remain the booking-state authority.
        break;

      default:
        break;
    }

    const { error: markError } = await admin.rpc(
      "mark_stripe_webhook_processed",
      { p_event_id: event.id },
    );
    if (markError) throw new Error("webhook_mark_processed_failed");

    return json({ received: true }, 200);
  } catch (cause) {
    const safeError =
      cause instanceof Error ? cause.message : "webhook_processing_failed";

    await admin.rpc("mark_stripe_webhook_failed", {
      p_event_id: event.id,
      p_error: safeError,
    });

    console.error("[stripe-webhook] Processing failed", event.id, safeError);
    return json({ error: "Webhook processing failed" }, 500);
  }
});
