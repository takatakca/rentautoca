import { Link } from "react-router-dom";
import { Car, Heart, MapPin, Star, Zap, Plane, CalendarDays, BadgeCheck } from "lucide-react";
import { useFavorite } from "@/hooks/use-favorite";
import { cn } from "@/lib/utils";
import type { DiscoveryCar } from "@/hooks/use-discovery-inventory";

function Badge({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "primary" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border",
        tone === "primary"
          ? "bg-primary/10 text-primary border-primary/20"
          : "bg-card/90 text-foreground border-border"
      )}
    >
      {children}
    </span>
  );
}

export function DiscoveryCarCard({ car }: { car: DiscoveryCar }) {
  const { isFavorite, toggle, loading } = useFavorite(car.id);
  const isEv = /electric|ev/i.test(car.fuel_type);

  return (
    <div className="group relative">
      <Link to={`/cars/${car.id}`} className="block">
        <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-muted mb-2">
          {car.photo_url ? (
            <img
              src={car.photo_url}
              alt={`${car.year} ${car.make} ${car.model} available to rent${car.location_label ? ` in ${car.location_label}` : ""}`}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover motion-safe:group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-accent/50 to-muted flex items-center justify-center">
              <Car className="h-10 w-10 text-muted-foreground/30" aria-hidden="true" />
            </div>
          )}
          <div className="absolute top-2 left-2 flex flex-wrap gap-1 max-w-[80%]">
            {car.available_today && <Badge tone="primary">Available today</Badge>}
            {car.instant_book && <Badge><BadgeCheck className="h-3 w-3" /> Instant</Badge>}
          </div>
        </div>
      </Link>

      <button
        type="button"
        onClick={toggle}
        disabled={loading}
        aria-pressed={isFavorite}
        aria-label={isFavorite ? `Remove ${car.make} ${car.model} from favorites` : `Save ${car.make} ${car.model} to favorites`}
        className="absolute top-2 right-2 w-9 h-9 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center hover:scale-110 motion-safe:transition-transform"
      >
        <Heart className={cn("h-4 w-4", isFavorite ? "fill-primary text-primary" : "text-foreground")} />
      </button>

      <Link to={`/cars/${car.id}`} className="block">
        <h3 className="font-bold text-sm truncate">{car.make} {car.model} {car.year}</h3>
        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 truncate">
          <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
          {car.location_label || "Quebec"}
          {car.distance_km !== null && <span>· {car.distance_km} km away</span>}
        </p>
        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">
            ${(car.base_daily_price_cents / 100).toFixed(0)}
            <span className="font-normal text-muted-foreground">/day</span>
          </p>
          {car.rating !== null && (
            <span className="text-xs text-muted-foreground inline-flex items-center gap-0.5">
              <Star className="h-3 w-3 fill-current text-foreground" aria-hidden="true" />
              {car.rating} ({car.reviews})
            </span>
          )}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {isEv && <Badge><Zap className="h-3 w-3" /> EV</Badge>}
          {car.airport_pickup_enabled && <Badge><Plane className="h-3 w-3" /> Airport</Badge>}
          {car.monthly_enabled && <Badge><CalendarDays className="h-3 w-3" /> Monthly</Badge>}
        </div>
      </Link>
    </div>
  );
}

export function CarRail({
  title,
  subtitle,
  cars,
  seeAllHref,
}: {
  title: string;
  subtitle?: string;
  cars: DiscoveryCar[];
  seeAllHref?: string;
}) {
  if (cars.length === 0) return null;
  return (
    <section className="container py-8 md:py-10">
      <div className="flex items-end justify-between gap-4 mb-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight">{title}</h2>
          {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {seeAllHref && (
          <Link to={seeAllHref} className="text-sm text-primary font-medium hover:underline shrink-0">
            See all
          </Link>
        )}
      </div>
      <ul className="flex gap-4 overflow-x-auto scrollbar-hide snap-x md:grid md:grid-cols-4 md:overflow-visible -mx-4 px-4 md:mx-0 md:px-0">
        {cars.slice(0, 8).map((car) => (
          <li key={car.id} className="w-[62%] sm:w-[42%] md:w-auto shrink-0 snap-start">
            <DiscoveryCarCard car={car} />
          </li>
        ))}
      </ul>
    </section>
  );
}
