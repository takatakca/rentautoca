import { LegalLayout } from "@/components/legal/LegalLayout";

export default function Terms() {
  return (
    <LegalLayout title="Terms of Service" updated="May 14, 2026">
      <p>These Terms of Service ("Terms") govern your access to and use of the Rentauto.ca peer-to-peer car rental marketplace operated for users in Canada (the "Platform"). By creating an account, listing a vehicle, or booking a trip you agree to these Terms.</p>
      <h2>1. The marketplace</h2>
      <p>Rentauto provides a venue connecting vehicle owners ("Hosts") with people who wish to rent those vehicles ("Guests"). Rentauto is not a party to the rental agreement between Host and Guest, is not a vehicle owner, and does not provide insurance.</p>
      <h2>2. Eligibility</h2>
      <ul>
        <li>You must be at least 21 years old (25 for premium vehicles) and hold a valid Canadian driver's licence or equivalent recognized by the province of pickup.</li>
        <li>Hosts must own the vehicle they list or have written authorization from the owner, and the vehicle must hold valid registration and insurance.</li>
      </ul>
      <h2>3. Bookings and payment</h2>
      <p>All bookings are processed in Canadian dollars (CAD). Applicable taxes including GST and Quebec QST are calculated at checkout. Rentauto charges a service fee on each completed booking.</p>
      <h2>4. Cancellations</h2>
      <p>Cancellation outcomes are governed by the per-vehicle policy disclosed at checkout — see the <a href="/cancellation-policy">Cancellation Policy</a>.</p>
      <h2>5. Prohibited use</h2>
      <p>Vehicles may not be used for street racing, off-road driving (unless permitted), commercial ride-share, transport of illegal goods, or by any driver not declared at booking.</p>
      <h2>6. Liability</h2>
      <p>To the maximum extent permitted by law, Rentauto's aggregate liability arising from your use of the Platform is limited to the service fees you paid in the prior 12 months.</p>
      <h2>7. Quebec Consumer Protection Act</h2>
      <p>Nothing in these Terms limits the rights granted to Quebec consumers under the <em>Loi sur la protection du consommateur</em> (CQLR c P-40.1).</p>
      <h2>8. Governing law</h2>
      <p>These Terms are governed by the laws of the Province of Ontario and the federal laws of Canada applicable therein, except where mandatory consumer-protection law of your province of residence applies.</p>
      <h2>9. Contact</h2>
      <p>support@rentauto.ca</p>
    </LegalLayout>
  );
}
