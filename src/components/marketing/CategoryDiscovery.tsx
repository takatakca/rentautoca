import { Link } from "react-router-dom";
import { Plane, CalendarDays, Zap, Sparkles, Car, Users, Snowflake, Wallet, Mountain, Sun } from "lucide-react";
import { exploreUrl, SearchState } from "@/lib/search-state";

const categories: Array<{ label: string; icon: typeof Car; hint: string; state: SearchState; href?: string }> = [
  { label: "Budget", icon: Wallet, hint: "Under $70/day", state: { maxPrice: 70, sort: "price_asc" } },
  { label: "SUV", icon: Mountain, hint: "Space & traction", state: { category: "SUV" } },
  { label: "Luxury", icon: Sparkles, hint: "Premium badges", state: { category: "Luxury" }, href: "/luxury-rentals" },
  { label: "Electric", icon: Zap, hint: "Zero emissions", state: { electric: true, category: "Electric" }, href: "/electric-vehicles" },
  { label: "Family", icon: Users, hint: "5+ seats", state: { seats: 5 } },
  { label: "7+ seats", icon: Users, hint: "Groups & gear", state: { seats: 7 } },
  { label: "Winter-ready", icon: Snowflake, hint: "Snow tires", state: { category: "Winter" } },
  { label: "Airport", icon: Plane, hint: "YUL & YQB", state: { airport: true, category: "Airports" }, href: "/airport-rentals" },
  { label: "Monthly", icon: CalendarDays, hint: "Long stays", state: { monthly: true, category: "Monthly" }, href: "/monthly-car-rentals" },
  { label: "Weekend", icon: Sun, hint: "Fri → Sun", state: { category: "Weekend" } },
];

export function CategoryDiscovery() {
  return (
    <section className="container py-10 md:py-14">
      <div className="mb-5">
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Browse by the trip you're taking</h2>
        <p className="text-muted-foreground mt-1">Every card lands you in Explore with the filters already set.</p>
      </div>
      <ul className="flex gap-3 overflow-x-auto scrollbar-hide snap-x md:grid md:grid-cols-5 md:overflow-visible -mx-4 px-4 md:mx-0 md:px-0">
        {categories.map((c) => (
          <li key={c.label} className="w-[42%] sm:w-[30%] md:w-auto shrink-0 snap-start">
            <Link
              to={c.href ?? exploreUrl(c.state)}
              className="group h-full flex flex-col rounded-2xl border border-border/60 bg-card p-4 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 motion-safe:hover:-translate-y-0.5 transition-all"
            >
              <span className="w-10 h-10 rounded-xl bg-accent text-accent-foreground flex items-center justify-center mb-3 motion-safe:group-hover:scale-105 transition-transform">
                <c.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="font-semibold text-sm">{c.label}</span>
              <span className="text-xs text-muted-foreground mt-0.5">{c.hint}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
