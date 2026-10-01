import { LegalLayout } from "@/components/legal/LegalLayout";

export default function CancellationPolicy() {
  return (
    <LegalLayout title="Cancellation Policy" updated="October 1, 2026">
      <p>
        Each Rentauto booking stores a snapshot of the cancellation policy shown
        before payment. That saved policy — not a later change to the listing —
        is used to calculate any automatic cancellation refund.
      </p>

      <h2>Guest cancellations</h2>
      <p>
        When the saved booking policy explicitly defines an automatic refund
        percentage and time window, Rentauto applies that rule to the charged
        booking total. The exact result is shown before the Guest confirms the
        cancellation.
      </p>
      <p>
        If the saved policy does not explicitly cover the timing or payment
        state of a cancellation, Rentauto does not guess a fee or refund amount.
        The request is sent to operations for manual review and the booking
        remains reserved until a decision is recorded.
      </p>

      <h2>Host cancellations</h2>
      <p>
        A Host cancellation of a paid booking is processed as a full refund to
        the Guest's original payment method. Any additional promotional or
        goodwill credit is only provided when Rentauto states it separately in
        writing; no extra credit is automatically promised by this policy.
      </p>

      <h2>Payment processing</h2>
      <p>
        Approved refunds are returned to the original payment method through
        Stripe. Some refunds can remain pending or require additional action
        before they succeed. Rentauto does not release the vehicle's booking
        block while a required refund is unresolved.
      </p>

      <h2>After a trip starts</h2>
      <p>
        Once a trip is active, the normal cancellation workflow no longer
        applies. Safety, accident, damage, early-return, or other active-trip
        issues must be reported through the trip incident or support workflow so
        that evidence and financial decisions are preserved.
      </p>

      <h2>Exceptional circumstances</h2>
      <p>
        Extreme weather, government orders, payment disputes, or other cases not
        explicitly covered by the saved policy are reviewed case by case. Any
        manual refund amount is recorded in the cancellation audit trail before
        it is submitted to Stripe.
      </p>
    </LegalLayout>
  );
}
