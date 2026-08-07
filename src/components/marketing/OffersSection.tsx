import { Link } from "react-router-dom";
import { CalendarDays, Plane, Zap, Gauge } from "lucide-react";
import type { DiscoveryCar } from "@/hooks/use-discovery-inventory";
import { exploreUrl } from "@/lib/search-state";

/**
 * Offers are derived from real listing data only (monthly eligibility, airport
 * readiness, included kilometres, real daily prices). Nothing here invents a
 * discount or a crossed-out price — the quote engine stays the pricing authority.
 */
export function OffersSection({ cars }: { cars: DiscoveryCar[] }) {
  const monthly = cars.filter((c) => c.monthly_enabled).sort((a, b) => a.base_daily_price_cents - b.base_daily_price_cents)[0];
  const cheapest = [...cars].sort((a, b) => a.base_daily_price_cents - b.base_daily_price_cents)[0];
  const airport = cars.filter((c) => c.airport_pickup_enabled).sort((a, b) => a.base_daily_price_cents - b.base_daily_price_cents)[0];
  const ev = cars.filter((c) => /electric/i.test(c.fuel_type))[0];

  const tiles = [
    monthly && {
      key: "monthly",
      icon: CalendarDays,
      title: "Monthly rentals",
      body: `From $${(monthly.base_daily_price_cents / 100).toFixed(0)}/day · about $${Math.round((monthly.base_daily_price_cents * 30) / 100).toLocaleString()} for 30 days (estimate)`,
      href: "/monthly-car-rentals",
      cta: "See monthly cars",
    },
    cheapest && {
      key: "value",
      icon: Gauge,
      title: "Best value today",
      body: `${cheapest.year} ${cheapest.make} ${cheapest.model} at $${(cheapest.base_daily_price_cents / 100).toFixed(0)}/day with ${cheapest.included_km_per_day} km included per day.`,
      href: `/cars/${cheapest.id}`,
      cta: "View this car",
    },
    airport && {
      key: "airport",
      icon: Plane,
      title: "Airport pickup",
      body: `Cars ready at YUL and YQB from $${(airport.base_daily_price_cents / 100).toFixed(0)}/day, handed over curb-side by the host.`,
      href: "/airport-rentals",
      cta: "Browse airport cars",
    },
    ev && {
      key: "ev",
      icon: Zap,
      title: "Electric picks",
      body: `Skip the gas station — ${ev.year} ${ev.make} ${ev.model} and more EVs available across Quebec.`,
      href: "/electric-vehicles",
      cta: "See electric cars",
    },
  ].filter(Boolean) as Array<{ key: string; icon: typeof Plane; title: string; body: string; href: string; cta: string }>;

  if (tiles.length === 0) return null;

  return (
    <section className="container py-10 md:py-14">
      <div className="flex items-end justify-between gap-4 mb-5">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Deals near you</h2>
          <p className="text-muted-foreground mt-1">
            Live pricing from real listings. Final totals always come from checkout.
          </p>
        </div>
        <Link to={exploreUrl({ sort: "price_asc" })} className="text-sm text-primary font-medium hover:underline shrink-0">
          Lowest priced
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <Link
            key={t.key}
            to={t.href}
            className="group rounded-2xl border border-border/60 bg-gradient-to-br from-accent/30 via-card to-card p-5 hover:border-primary/40 motion-safe:hover:-translate-y-0.5 transition-all"
          >
            <span className="w-10 h-10 rounded-xl bg-background/70 text-primary flex items-center justify-center mb-3">
              <t.icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <h3 className="font-semibold">{t.title}</h3>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{t.body}</p>
            <span className="mt-3 inline-block text-sm text-primary font-medium">{t.cta} →</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
