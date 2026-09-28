import { useState } from "react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { CalendarDays, Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { TripQuote } from "@/hooks/use-trip-quote";

interface Props {
  dailyCents: number;
  startDate: Date;
  endDate: Date;
  onDatesChange: (start: Date, end: Date) => void;
  pickupLabel: string | null;
  quote: TripQuote | undefined;
  quoteLoading: boolean;
  notice: string | null;
  ctaLabel: string;
  disabled: boolean;
  busy: boolean;
  onContinue: () => void;
}

const $ = (c: number) => `$${(c / 100).toFixed(2)}`;

/** Booking sidebar. Renders server quote only — never computes final price locally. */
export function BookingPanel(p: Props) {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<DateRange | undefined>({ from: p.startDate, to: p.endDate });
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const apply = (r: DateRange | undefined) => {
    setRange(r);
    if (r?.from && r?.to && r.to > r.from) {
      p.onDatesChange(r.from, r.to);
      setOpen(false);
    }
  };

  const q = p.quote;

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-5">
      <p className="text-2xl font-bold">
        ${(p.dailyCents / 100).toFixed(0)}
        <span className="text-base font-normal text-muted-foreground">/day</span>
      </p>

      <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setRange({ from: p.startDate, to: p.endDate }); }}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Change trip dates"
            className="grid w-full grid-cols-2 overflow-hidden rounded-lg border border-border text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="border-r border-border p-3">
              <span className="block text-[11px] uppercase tracking-wide text-muted-foreground">Trip start</span>
              <span className="flex items-center gap-1.5 text-sm font-medium"><CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />{format(p.startDate, "EEE, MMM d")}</span>
            </span>
            <span className="p-3">
              <span className="block text-[11px] uppercase tracking-wide text-muted-foreground">Trip end</span>
              <span className="flex items-center gap-1.5 text-sm font-medium"><CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />{format(p.endDate, "EEE, MMM d")}</span>
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="range"
            selected={range}
            onSelect={apply}
            numberOfMonths={1}
            defaultMonth={p.startDate}
            disabled={(d) => d < today}
            className="p-3 pointer-events-auto"
          />
          <p className="px-4 pb-3 text-xs text-muted-foreground">
            {range?.from && !range.to ? "Now pick a return date." : "Select pickup, then return."}
          </p>
        </PopoverContent>
      </Popover>

      <div className="flex items-start gap-2 text-sm">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div>
          <p className="font-medium">Pickup & return</p>
          <p className="text-muted-foreground">{p.pickupLabel || "Location shared after booking"}</p>
        </div>
      </div>

      <div className="border-t border-border pt-4 text-sm space-y-2" aria-live="polite">
        {p.quoteLoading ? (
          <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Calculating price…</p>
        ) : q ? (
          <>
            <Row label={`Rental · ${q.days} ${q.days === 1 ? "day" : "days"}`} value={$(q.base_price)} />
            {q.discounts > 0 && <Row label={`Discount (${q.discount_percent}%)`} value={`-${$(q.discounts)}`} accent />}
            {q.protection_snapshot && <Row label={`${q.protection_snapshot.name} protection`} value={q.protection_total > 0 ? $(q.protection_total) : "Included"} />}
            {q.extras_breakdown.map((e) => <Row key={e.name} label={e.name} value={$(e.price_cents)} />)}
            <Row label="Taxes" value={$(q.taxes)} />
            <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
              <span>Total</span><span>{$(q.total_after_tax)} {q.currency?.toUpperCase() || "CAD"}</span>
            </div>
          </>
        ) : (
          <p className="text-muted-foreground">Choose dates to see your price.</p>
        )}
      </div>

      {p.notice && <p className="text-xs text-muted-foreground">{p.notice}</p>}

      <Button size="lg" className="w-full" disabled={p.disabled || p.busy} onClick={p.onContinue}>
        {p.ctaLabel}
      </Button>
      <p className="text-center text-xs text-muted-foreground">You won't be charged yet.</p>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${accent ? "text-success" : ""}`}>
      <span className={accent ? "" : "text-muted-foreground"}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

