import { LegalLayout } from "@/components/legal/LegalLayout";

export default function Insurance() {
  return (
    <LegalLayout title="Insurance & Protection" updated="May 14, 2026">
      <p>Every trip booked through Rentauto includes a Protection Plan selected by the Guest at checkout. Plans are underwritten by our partner insurer and provide third-party liability and physical-damage coverage for the duration of the rental, in addition to (and not in replacement of) the Host's primary insurance.</p>
      <h2>Plan tiers</h2>
      <ul>
        <li><strong>Basic — $10/day:</strong> $3,000 deductible, $1M third-party liability.</li>
        <li><strong>Silver — $18/day:</strong> $1,500 deductible, $2M third-party liability, roadside assistance.</li>
        <li><strong>Gold — $28/day:</strong> $0 deductible, $2M third-party liability, roadside assistance, loss-of-use waiver.</li>
      </ul>
      <h2>Quebec specifics</h2>
      <p>Bodily injury arising from a motor-vehicle accident in Quebec is covered by the public no-fault regime administered by the <em>Société de l'assurance automobile du Québec</em> (SAAQ); private coverage applies to property damage and out-of-province incidents.</p>
      <h2>Exclusions</h2>
      <p>Coverage does not apply to mechanical failure unrelated to a covered incident, intentional damage, use by undisclosed drivers, off-road use, or use during the commission of a crime.</p>
      <h2>Claims</h2>
      <p>Report incidents within 24 hours by emailing claims@rentauto.ca with photos, location, and a written description. A claims specialist will respond within one business day.</p>
    </LegalLayout>
  );
}
