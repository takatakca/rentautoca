import { Link } from "react-router-dom";
import { exploreUrl } from "@/lib/search-state";
import suv from "@/assets/cat-suv.jpg";
import luxury from "@/assets/cat-luxury.jpg";
import family from "@/assets/cat-family.jpg";
import budget from "@/assets/cat-budget.jpg";
import ev from "@/assets/ev.jpg";

const cats = [
  { label: "Budget", note: "Under $70 / day", img: budget, to: exploreUrl({ maxPrice: 70, sort: "price_asc" }) },
  { label: "SUV", note: "Space & winter traction", img: suv, to: exploreUrl({ category: "SUV" }) },
  { label: "Luxury", note: "Premium badges", img: luxury, to: "/luxury-rentals" },
  { label: "Family", note: "5–7 seats", img: family, to: exploreUrl({ seats: 5 }) },
  { label: "Electric", note: "Zero emissions", img: ev, to: "/electric-vehicles" },
];

/** Showroom-style category strip: vehicle photography on a neutral studio surface. */
export function ShowroomCategories() {
  return (
    <section className="border-y border-border/60 bg-secondary/40">
      <div className="container py-12 md:py-16">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">The showroom</p>
            <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">Pick your kind of car</h2>
          </div>
        </div>
        <ul className="flex gap-4 overflow-x-auto scrollbar-hide snap-x md:grid md:grid-cols-5 md:overflow-visible -mx-4 px-4 md:mx-0 md:px-0">
          {cats.map((c) => (
            <li key={c.label} className="w-[58%] sm:w-[38%] md:w-auto shrink-0 snap-start">
              <Link
                to={c.to}
                className="group block rounded-2xl bg-card border border-border/60 overflow-hidden hover:border-primary/40 motion-safe:hover:-translate-y-1 transition-all"
              >
                <div className="aspect-[5/4] bg-background overflow-hidden">
                  <img
                    src={c.img}
                    alt={`${c.label} rental cars`}
                    loading="lazy"
                    decoding="async"
                    width={1000}
                    height={800}
                    className="h-full w-full object-cover motion-safe:transition-transform motion-safe:duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="p-4">
                  <h3 className="font-semibold">{c.label}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{c.note}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
