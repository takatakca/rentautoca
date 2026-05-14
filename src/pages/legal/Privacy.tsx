import { LegalLayout } from "@/components/legal/LegalLayout";

export default function Privacy() {
  return (
    <LegalLayout title="Privacy Policy" updated="May 14, 2026">
      <p>Rentauto.ca ("we", "us") respects your privacy. This Policy explains what personal information we collect and how we use it, in accordance with Canada's <em>Personal Information Protection and Electronic Documents Act</em> (PIPEDA) and Quebec's <em>Law 25</em>.</p>
      <h2>1. Information we collect</h2>
      <ul>
        <li><strong>Account:</strong> name, email, phone, password hash, profile photo, address.</li>
        <li><strong>Identity verification:</strong> driver's licence images, selfie, date of birth.</li>
        <li><strong>Bookings &amp; payments:</strong> trip details, pricing, payment tokens (held by Stripe — we do not store card numbers).</li>
        <li><strong>Device data:</strong> IP address, browser, approximate location, cookies.</li>
      </ul>
      <h2>2. How we use it</h2>
      <ul>
        <li>Operate the marketplace and process bookings.</li>
        <li>Verify identity and prevent fraud.</li>
        <li>Comply with legal obligations and respond to lawful requests.</li>
        <li>Send transactional emails; marketing only with your opt-in.</li>
      </ul>
      <h2>3. Sharing</h2>
      <p>We share information with the counterparty to a booking (Host or Guest) as needed to fulfill the rental, and with service providers (Stripe for payments, Supabase for hosting, ID verification vendors) under contract.</p>
      <h2>4. Retention</h2>
      <p>We retain personal information for as long as your account is active and up to 7 years afterward to comply with tax and dispute-resolution obligations.</p>
      <h2>5. Your rights (PIPEDA &amp; Quebec Law 25)</h2>
      <p>You may request access, correction, portability, or deletion of your personal information by emailing privacy@rentauto.ca. Quebec residents may also lodge a complaint with the <em>Commission d'accès à l'information du Québec</em>.</p>
      <h2>6. Data residency</h2>
      <p>Personal information is stored on infrastructure located in Canada and the United States. By using the Platform you consent to such cross-border transfer.</p>
      <h2>7. Contact</h2>
      <p>Privacy Officer — privacy@rentauto.ca</p>
    </LegalLayout>
  );
}
