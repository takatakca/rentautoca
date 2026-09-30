import { LegalLayout } from "@/components/legal/LegalLayout";

export default function Insurance() {
  return (
    <LegalLayout title="Insurance & Protection" updated="September 30, 2026">
      <p>
        Rentauto is preparing its protection program for launch in Quebec. The
        booking experience is built to support protection options, but no
        specific insurer, liability limit, deductible, roadside benefit, or
        loss-of-use benefit is represented as active until the applicable
        insurance arrangement and customer-facing terms are finalized.
      </p>

      <h2>Before you book</h2>
      <p>
        The checkout page will show the protection terms that actually apply to
        that trip before payment. Those trip-specific terms, not marketing copy,
        will control the protection selection.
      </p>

      <h2>Quebec automobile insurance</h2>
      <p>
        Quebec has a public automobile insurance regime for bodily injury and a
        separate private automobile insurance system. Vehicle owners must
        maintain the private insurance required for their vehicle and use.
        Rentauto does not replace a host's underlying legal or insurance
        obligations.
      </p>

      <h2>Launch status</h2>
      <p>
        Protection-plan names and pricing visible in pre-launch environments are
        product configuration for testing unless the checkout expressly states
        that the plan is active and provides the applicable contractual terms.
      </p>

      <h2>Incidents</h2>
      <p>
        The Rentauto trip workflow records incident details and supporting
        evidence. Claims instructions and insurer contact information will be
        displayed with the applicable trip once the production protection
        program is activated.
      </p>
    </LegalLayout>
  );
}
