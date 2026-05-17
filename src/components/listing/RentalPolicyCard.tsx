import { Shield, AlertTriangle, Fuel, Clock, IdCard, Ban } from "lucide-react";

interface Props {
  ageRequirement?: number;
  securityDepositCents?: number | null;
  fuelRule?: string;
  lateReturnFeePerHourCents?: number;
  smokingFeeCents?: number;
  cleaningFeeCents?: number;
}

export function RentalPolicyCard({
  ageRequirement = 21,
  securityDepositCents = null,
  fuelRule = "Return with the same fuel/charge level as pickup.",
  lateReturnFeePerHourCents = 2500,
  smokingFeeCents = 15000,
  cleaningFeeCents = 15000,
}: Props) {
  const rows: { icon: React.ElementType; title: string; body: string }[] = [
    { icon: IdCard, title: "Driver requirements", body: `Minimum age ${ageRequirement}. Valid driver's license required and verified before pickup.` },
    { icon: Shield, title: "Security deposit", body: securityDepositCents ? `A $${(securityDepositCents / 100).toFixed(0)} hold may be placed on your card.` : "No upfront security deposit. Damages handled per protection plan." },
    { icon: Fuel, title: "Fuel / charging", body: fuelRule },
    { icon: Clock, title: "Late return", body: `Returns more than 15 min late are billed $${(lateReturnFeePerHourCents / 100).toFixed(0)}/hour, then a full extra day after 3 hours.` },
    { icon: Ban, title: "Smoking & pets", body: `No smoking. Pets only if listed. Cleaning fee up to $${(cleaningFeeCents / 100).toFixed(0)}; smoking fee $${(smokingFeeCents / 100).toFixed(0)}.` },
    { icon: AlertTriangle, title: "Damage & incidents", body: "Damage must be reported within 24h via the trip page. Telematics may be used to verify incidents." },
  ];
  return (
    <section className="px-4 py-5">
      <h2 className="text-xl font-bold mb-3">Rental policies</h2>
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.title} className="flex gap-3">
            <r.icon className="h-5 w-5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-semibold text-sm">{r.title}</p>
              <p className="text-sm text-muted-foreground">{r.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
