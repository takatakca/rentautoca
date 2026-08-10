import { Link } from "react-router-dom";
import { SmartSearchConsole } from "@/components/marketing/SmartSearchConsole";
import heroDesktop from "@/assets/hero-road.jpg";
import heroMobile from "@/assets/hero-mobile.jpg";

interface EditorialHeroProps {
  availableToday?: number;
}

/**
 * Full-bleed automotive hero. Photography carries the art direction; the search
 * console sits on a solid surface so booking is the dominant action.
 */
export function EditorialHero({ availableToday }: EditorialHeroProps) {
  return (
    <section className="relative isolate">
      <div className="absolute inset-0 -z-10">
        <picture>
          <source media="(min-width: 768px)" srcSet={heroDesktop} />
          <img
            src={heroMobile}
            alt="Car on an open road heading into a Quebec landscape"
            width={1600}
            height={1000}
            fetchPriority="high"
            decoding="async"
            className="h-full w-full object-cover"
          />
        </picture>
        <div className="absolute inset-0 bg-overlay/70 md:bg-gradient-to-r md:from-overlay/85 md:via-overlay/60 md:to-overlay/20" />
      </div>

      <div className="container pt-24 pb-10 md:pt-36 md:pb-20">
        <div className="max-w-2xl">
          <p className="text-[11px] md:text-xs font-semibold uppercase tracking-[0.2em] text-overlay-muted">
            Car rental across Quebec
          </p>
          <h1 className="mt-3 text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-overlay-foreground leading-[1.02]">
            Rent a car from
            <br className="hidden sm:block" /> someone nearby.
          </h1>
          <p className="mt-4 text-base md:text-lg text-overlay-muted max-w-xl">
            Thousands of verified vehicles in Montreal, Quebec City, Laval and beyond — booked in minutes,
            picked up on your street or at the airport.
          </p>
          {typeof availableToday === "number" && availableToday > 0 && (
            <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-overlay-foreground/10 px-3 py-1.5 text-xs font-medium text-overlay-foreground backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-success motion-safe:animate-pulse" aria-hidden="true" />
              {availableToday} cars ready to drive today
            </p>
          )}
        </div>

        <div className="mt-8 md:mt-12 max-w-5xl">
          <SmartSearchConsole />
        </div>

        <p className="mt-5 text-xs text-overlay-muted">
          New here?{" "}
          <Link to="/how-it-works" className="font-medium text-overlay-foreground underline underline-offset-4">
            See how Rentauto works
          </Link>
        </p>
      </div>
    </section>
  );
}
