import { LegalLayout } from "@/components/legal/LegalLayout";

export default function CancellationPolicy() {
  return (
    <LegalLayout title="Cancellation Policy" updated="May 14, 2026">
      <p>Each listing on Rentauto displays one of three cancellation policies, chosen by the Host. The applicable policy is shown on the vehicle page and at checkout, and is captured in your booking confirmation.</p>
      <h2>Flexible</h2>
      <ul>
        <li>Free cancellation up to 24 hours before pickup.</li>
        <li>50% refund of base rental between 24 hours and 1 hour before pickup.</li>
        <li>Service fees are refunded only on full cancellations made &gt;24 hours before pickup.</li>
      </ul>
      <h2>Standard</h2>
      <ul>
        <li>Free cancellation up to 7 days before pickup.</li>
        <li>50% refund between 7 days and 24 hours before pickup.</li>
        <li>No refund within 24 hours of pickup.</li>
      </ul>
      <h2>Strict</h2>
      <ul>
        <li>50% refund up to 7 days before pickup.</li>
        <li>No refund within 7 days of pickup.</li>
      </ul>
      <h2>Host cancellations</h2>
      <p>If a Host cancels a confirmed booking, the Guest receives a full refund and a credit equal to 20% of the trip total. Repeated Host cancellations may lead to listing suspension.</p>
      <h2>Force majeure</h2>
      <p>Cancellations caused by extreme weather, government order, or other events beyond reasonable control will be reviewed case-by-case for full refunds.</p>
    </LegalLayout>
  );
}
