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
  const rentauto = admin.schema("rentauto");

  const { data: claimRows, error: claimError } = await admin.rpc(
    "rentauto_claim_stripe_webhook_event",
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

  async function findTripByPaymentIntent(paymentIntentId: string) {
    const { data, error } = await rentauto
      .from("trips")
      .select("id,status,total_cents,payment_status")
      .eq("stripe_payment_intent_id", paymentIntentId)
      .maybeSingle();

    if (error) throw new Error("trip_payment_lookup_failed");
    return data;
  }

  async function syncDispute(dispute: Stripe.Dispute) {
    const paymentIntentId =
      typeof dispute.payment_intent === "string"
        ? dispute.payment_intent
        : dispute.payment_intent && typeof dispute.payment_intent === "object"
          ? dispute.payment_intent.id
          : null;

    if (!paymentIntentId) return;

    const trip = await findTripByPaymentIntent(paymentIntentId);
    if (!trip) return;

    const dueBy = dispute.evidence_details?.due_by;
    const closedStatuses = new Set(["won", "lost", "warning_closed"]);
    const isClosed = closedStatuses.has(dispute.status);

    const { error: disputeError } = await rentauto
      .from("stripe_disputes")
      .upsert(
        {
          stripe_dispute_id: dispute.id,
          trip_id: trip.id,
          payment_intent_id: paymentIntentId,
          amount_cents: dispute.amount,
          currency: dispute.currency.toUpperCase(),
          reason: dispute.reason ?? null,
          status: dispute.status,
          evidence_due_by:
            typeof dueBy === "number"
              ? new Date(dueBy * 1000).toISOString()
              : null,
          updated_at: new Date().toISOString(),
          closed_at: isClosed ? new Date().toISOString() : null,
        },
        { onConflict: "stripe_dispute_id" },
      );

    if (disputeError) throw new Error("stripe_dispute_sync_failed");

    const { data: settlement, error: settlementError } = await rentauto
      .from("trip_settlements")
      .select(
        "id,status,stripe_transfer_id,host_amount_cents,reversed_amount_cents",
      )
      .eq("trip_id", trip.id)
      .maybeSingle();

    if (settlementError) throw new Error("settlement_dispute_lookup_failed");

    if (settlement) {
      if (!isClosed) {
        const nextStatus =
          settlement.stripe_transfer_id &&
          settlement.status !== "reversed"
            ? "reversal_required"
            : "blocked";

        const { error } = await rentauto
          .from("trip_settlements")
          .update({
            dispute_id: dispute.id,
            dispute_status: dispute.status,
            status: nextStatus,
            hold_reason: "payment_dispute",
            updated_at: new Date().toISOString(),
          })
          .eq("id", settlement.id);

        if (error) throw new Error("settlement_dispute_block_failed");
      } else if (dispute.status === "won" || dispute.status === "warning_closed") {
        if (settlement.stripe_transfer_id) {
          const hostAmount = settlement.host_amount_cents ?? 0;
          const reversed = settlement.reversed_amount_cents ?? 0;
          const restoredStatus =
            reversed >= hostAmount && hostAmount > 0
              ? "reversed"
              : reversed > 0
                ? "partially_reversed"
                : "transferred";

          const { error } = await rentauto
            .from("trip_settlements")
            .update({
              dispute_id: dispute.id,
              dispute_status: dispute.status,
              status: restoredStatus,
              hold_reason: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", settlement.id);

          if (error) throw new Error("settlement_dispute_restore_failed");
        } else {
          const { error } = await rentauto
            .from("trip_settlements")
            .update({
              dispute_id: dispute.id,
              dispute_status: dispute.status,
              updated_at: new Date().toISOString(),
            })
            .eq("id", settlement.id);

          if (error) throw new Error("settlement_dispute_close_failed");

          const { error: refreshError } = await rentauto.rpc(
            "refresh_trip_settlement",
            { p_trip_id: trip.id },
          );
          if (refreshError) throw new Error("settlement_dispute_refresh_failed");
        }
      } else {
        const { error } = await rentauto
          .from("trip_settlements")
          .update({
            dispute_id: dispute.id,
            dispute_status: dispute.status,
            status: settlement.stripe_transfer_id
              ? "reversal_required"
              : "blocked",
            hold_reason: "payment_dispute_lost",
            updated_at: new Date().toISOString(),
          })
          .eq("id", settlement.id);

        if (error) throw new Error("settlement_dispute_loss_failed");
      }
    }

    await rentauto.from("trip_events").insert({
      trip_id: trip.id,
      actor_user_id: null,
      event_type: `stripe_dispute_${dispute.status}`,
      payload_json: {
        dispute_id: dispute.id,
        amount: dispute.amount,
        currency: dispute.currency,
        reason: dispute.reason,
        status: dispute.status,
      },
    });
  }

  try {
    switch (event.type) {
      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        const chargesEnabled = account.charges_enabled ?? false;
        const payoutsEnabled = account.payouts_enabled ?? false;
        const isComplete = chargesEnabled && payoutsEnabled;

        const { data: existing } = await rentauto
          .from("stripe_accounts")
          .select("onboarded_at")
          .eq("stripe_account_id", account.id)
          .maybeSingle();

        const { error } = await rentauto
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
        const { error } = await rentauto
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

        const { data: trip, error: tripLookupError } = await rentauto
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
          "rentauto_finalize_paid_booking",
          {
            p_trip_id: tripId,
            p_stripe_session_id: session.id,
            p_payment_intent_id: paymentIntentId,
            p_amount_total: amountTotal,
            p_currency: currency,
            p_event_id: event.id,
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
          const { error: failError } = await admin.rpc(
            "rentauto_fail_checkout_session",
            {
              p_trip_id: tripId,
              p_stripe_session_id: session.id,
              p_event_type: event.type,
            },
          );

          if (failError) {
            throw new Error("checkout_failure_transition_failed");
          }
        }
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId =
          typeof charge.payment_intent === "string"
            ? charge.payment_intent
            : charge.payment_intent && typeof charge.payment_intent === "object"
              ? charge.payment_intent.id
              : null;

        if (paymentIntentId) {
          const { error: refundError } = await admin.rpc(
            "rentauto_record_payment_refund",
            {
              p_payment_intent_id: paymentIntentId,
              p_refunded_cents: charge.amount_refunded,
            },
          );

          if (refundError) throw new Error("settlement_refund_sync_failed");
        }
        break;
      }

      case "charge.dispute.created":
      case "charge.dispute.updated":
      case "charge.dispute.closed": {
        await syncDispute(event.data.object as Stripe.Dispute);
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
      "rentauto_mark_stripe_webhook_processed",
      { p_event_id: event.id },
    );
    if (markError) throw new Error("webhook_mark_processed_failed");

    return json({ received: true }, 200);
  } catch (cause) {
    const safeError =
      cause instanceof Error ? cause.message : "webhook_processing_failed";

    await admin.rpc("rentauto_mark_stripe_webhook_failed", {
      p_event_id: event.id,
      p_error: safeError,
    });

    console.error("[stripe-webhook] Processing failed", event.id, safeError);
    return json({ error: "Webhook processing failed" }, 500);
  }
});
