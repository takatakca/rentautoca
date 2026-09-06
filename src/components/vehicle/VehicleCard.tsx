import { Link } from "react-router-dom";
import { Car, Heart, Star, Zap, Plane, CalendarDays, BadgeCheck } from "lucide-react";
import { useFavorite } from "@/hooks/use-favorite";
import { cn } from "@/lib/utils";

/**
 * Canonical public vehicle shape. Every public surface (Home rails, Explore,
 * Favorites, Similar vehicles, Concierge results) renders through VehicleCard.
 */
export interface PublicVehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  trim?: string | null;
  base_daily_price_cents: number;
  location_label?: string | null;
  body_type?: string | null;
  seats?: number | null;
  fuel_type?: string | null;
  transmission?: string | null;
  included_km_per_day?: number | null;
  photo_url?: string | null;
  rating?: number | null;
  trips?: number | null;
  airport_pickup_enabled?: boolean | null;
  monthly_enabled?: boolean | null;
  instant_book?: boolean | null;
  available_today?: boolean | null;
  distance_km?: number | null;
}

export type VehicleCardVariant = "grid" | "rail" | "compact";


function CardBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-background/85 backdrop-blur-sm text-foreground">
      {children}
    </span>
  );
}

/** Max 2 badges, chosen by relevance. */
function topBadges(car: PublicVehicle) {
  const out: React.ReactNode[] = [];
  const isEv = /electric|ev/i.test(car.fuel_type || "");
  if (car.instant_book) out.push(<><BadgeCheck className="h-3 w-3" aria-hidden="true" /> Instant</>);
  if (isEv && out.length < 2) out.push(<><Zap className="h-3 w-3" aria-hidden="true" /> Electric</>);
  if (car.airport_pickup_enabled && out.length < 2) out.push(<><Plane className="h-3 w-3" aria-hidden="true" /> Airport</>);
  if (car.monthly_enabled && out.length < 2) out.push(<><CalendarDays className="h-3 w-3" aria-hidden="true" /> Monthly</>);
  return out.slice(0, 2);
}

export function VehicleCard({
  car,
  tripDays,
  className,
  eager,
  variant = "grid",
  footer,
  hideFavorite,
}: {
  car: PublicVehicle;
  /** When dates are selected, show an estimated trip total. */
  tripDays?: number | null;
  className?: string;
  eager?: boolean;
  /** Layout density. Visual identity stays identical across variants. */
  variant?: VehicleCardVariant;
  /** Context actions (compare, select, remove) rendered under the card. */
  footer?: React.ReactNode;
  hideFavorite?: boolean;
}) {
  const { isFavorite, toggle, loading } = useFavorite(car.id);
  const daily = car.base_daily_price_cents / 100;
  const total = tripDays ? daily * tripDays : null;
  const compact = variant === "compact";
  const specs = [car.location_label || undefined, car.body_type || undefined, car.seats ? `${car.seats} seats` : undefined]
    .filter(Boolean)
    .join(" · ");

  return (
    <article
      className={cn(
        "group relative",
        variant === "rail" && "w-full",
        compact && "w-[15.5rem] shrink-0",
        className,
      )}
    >
      <Link to={`/cars/${car.id}`} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg">
        <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-muted">
          {car.photo_url ? (
            <img
              src={car.photo_url}
              alt={`${car.year} ${car.make} ${car.model} for rent${car.location_label ? ` in ${car.location_label}` : ""}`}
              loading={eager ? "eager" : "lazy"}
              decoding="async"
              className="h-full w-full object-cover motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:scale-[1.04]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-accent/40 to-muted">
              <Car className="h-10 w-10 text-muted-foreground/30" aria-hidden="true" />
            </div>
          )}
          <div className="absolute bottom-2 left-2 flex flex-wrap gap-1">
            {topBadges(car).map((b, i) => (
              <CardBadge key={i}>{b}</CardBadge>
            ))}
          </div>
        </div>

        <div className="pt-2.5">
          <h3 className={cn("font-semibold leading-tight tracking-tight truncate", compact && "text-sm")}>
            {car.year} {car.make} {car.model}
          </h3>
          {specs && (
            <p className={cn("mt-0.5 truncate text-muted-foreground", compact ? "text-xs" : "text-sm")}>{specs}</p>
          )}
          <p className={cn("mt-0.5 text-muted-foreground", compact ? "text-xs" : "text-sm")}>
            {car.rating != null ? (
              <span className="inline-flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-current text-foreground" aria-hidden="true" />
                <span className="font-medium text-foreground">{car.rating}</span>
                {car.trips ? <span>· {car.trips} {car.trips === 1 ? "trip" : "trips"}</span> : null}
              </span>
            ) : (
              "New listing"
            )}
            {car.distance_km != null && <span> · {car.distance_km} km away</span>}
          </p>
          <p className={cn("mt-1.5 font-semibold", compact && "text-sm")}>
            ${daily.toFixed(0)}
            <span className="font-normal text-muted-foreground">/day</span>
            {total != null && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">${total.toFixed(0)} total</span>
            )}
          </p>
        </div>
      </Link>

      {footer ? <div className="pt-2">{footer}</div> : null}

      {!hideFavorite && (
        <button
          type="button"
          onClick={toggle}
          disabled={loading}
          aria-pressed={isFavorite}
          aria-label={isFavorite ? `Remove ${car.make} ${car.model} from favorites` : `Save ${car.make} ${car.model} to favorites`}
          className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-background/80 backdrop-blur-sm motion-safe:transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Heart className={cn("h-4 w-4", isFavorite ? "fill-primary text-primary" : "text-foreground")} aria-hidden="true" />
        </button>
      )}
    </article>
  );
}

