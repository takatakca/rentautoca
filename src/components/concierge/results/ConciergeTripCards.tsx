import { Link } from "react-router-dom";
import { format } from "date-fns";
import { CalendarDays, MapPin, ArrowRight } from "lucide-react";

interface TripRow {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  payment_status?: string | null;
  total_cents?: number | null;
  currency?: string | null;
  pickup_location?: string | null;
}

const safeDate = (v: string) => {
  const d = new Date(v);
  return isNaN(d.getTime()) ? v : format(d, "MMM d");
};

export function ConciergeTripCards({ trips }: { trips: TripRow[] }) {
  if (!trips?.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
        No bookings yet.
      </div>
    );
  }

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Your bookings
      </h3>
      <div className="grid gap-2">
        {trips.map((t) => (
          <Link
            key={t.id}
            to={`/trips/${t.id}`}
            className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition-colors hover:bg-secondary/50"
          >
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {safeDate(t.start_at)} – {safeDate(t.end_at)}
              </p>
              <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                {t.pickup_location || "Pickup details in trip"} · {t.status.replace(/_/g, " ")}
              </p>
            </div>
            {t.total_cents ? (
              <span className="text-sm font-semibold">${(t.total_cents / 100).toFixed(0)}</span>
            ) : null}
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </Link>
        ))}
      </div>
    </section>
  );
}
