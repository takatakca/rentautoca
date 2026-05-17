import { MapPin, ShieldCheck } from "lucide-react";

export function TrackingDisclosureCard() {
  return (
    <section className="px-4 py-5">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h2 className="font-bold">Vehicle tracking disclosure</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          This vehicle may be equipped with a telematics device. Tracking is only
          active <span className="text-foreground font-medium">after you complete
          check-in</span> and stops automatically when you complete check-out.
          Data is used for safety, recovery, mileage verification, and dispute
          protection. Rentauto never tracks vehicles outside an active rental.
        </p>
        <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          <span>Active rental window only · Encrypted at rest</span>
        </div>
      </div>
    </section>
  );
}
