import { Link } from "react-router-dom";
import { Receipt, ShieldCheck, Gauge, CalendarDays, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QuoteLike {
  days?: number;
  base_price?: number;
  extras_total?: number;
  protection_total?: number;
  protection_snapshot?: { name?: string; tier?: string; deductible_cents?: number } | null;
  discounts?: number;
  discount_percent?: number;
  taxes?: number;
  total_after_tax?: number;
  included_km_total?: number;
  currency?: string;
  error?: string;
}

const m = (c?: number) => `$${((c ?? 0) / 100).toFixed(2)}`;

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className={muted ? "text-muted-foreground" : ""}>{label}</span>
      <span className={muted ? "text-muted-foreground" : "font-medium"}>{value}</span>
    </div>
  );
}

export function ConciergeQuoteCard({ quote, carId }: { quote: QuoteLike; carId?: string }) {
  if (quote?.error) {
    return (
      <div className="rounded-2xl border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
        Pricing unavailable for those dates: {quote.error}
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <header className="flex items-center gap-2 border-b border-border bg-secondary/40 px-4 py-2.5">
        <Receipt className="h-4 w-4 text-primary" aria-hidden="true" />
        <h3 className="text-sm font-semibold">Trip price</h3>
        {quote.days ? (
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            {quote.days} day{quote.days === 1 ? "" : "s"}
          </span>
        ) : null}
      </header>

      <div className="space-y-1.5 px-4 py-3">
        <Row label="Vehicle" value={m(quote.base_price)} />
        {!!quote.extras_total && <Row label="Extras" value={m(quote.extras_total)} />}
        {!!quote.protection_total && (
          <Row
            label={`Protection${quote.protection_snapshot?.name ? ` · ${quote.protection_snapshot.name}` : ""}`}
            value={m(quote.protection_total)}
          />
        )}
        {!!quote.discounts && (
          <Row
            label={`Multi-day discount${quote.discount_percent ? ` (${quote.discount_percent}%)` : ""}`}
            value={`−${m(quote.discounts)}`}
          />
        )}
        {!!quote.taxes && <Row label="Taxes" value={m(quote.taxes)} muted />}

        <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
          <span className="text-sm font-semibold">Total</span>
          <span className="text-lg font-bold">
            {m(quote.total_after_tax)} <span className="text-xs font-normal text-muted-foreground">CAD</span>
          </span>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs text-muted-foreground">
          {quote.included_km_total ? (
            <span className="inline-flex items-center gap-1">
              <Gauge className="h-3.5 w-3.5" aria-hidden="true" /> {quote.included_km_total} km included
            </span>
          ) : null}
          {quote.protection_snapshot?.deductible_cents !== undefined && (
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              {m(quote.protection_snapshot.deductible_cents)} deductible
            </span>
          )}
        </div>

        {carId ? (
          <Button asChild size="sm" className="mt-3 h-9 w-full rounded-xl">
            <Link to={`/cars/${carId}`}>
              Continue to booking <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        ) : null}
      </div>
    </section>
  );
}
