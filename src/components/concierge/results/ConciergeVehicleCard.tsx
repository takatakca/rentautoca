import { Link } from "react-router-dom";
import { Car, MapPin, Star, Users, Fuel, Gauge, Plane, CalendarRange, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useCarPhotos } from "@/hooks/use-car-photos";
import { useCompare, type CompareVehicle } from "./compare-context";
import { cn } from "@/lib/utils";

export interface ConciergeVehicle extends CompareVehicle {
  title?: string | null;
  doors?: number | null;
  airport_pickup_enabled?: boolean | null;
  monthly_enabled?: boolean | null;
  instant_book?: boolean | null;
  consumption_l_per_100km?: number | null;
}

const money = (cents: number) => `$${Math.round(cents / 100)}`;

function Spec({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {children}
    </span>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background/60 px-2 py-0.5 text-[11px] font-medium">
      {children}
    </span>
  );
}

export function ConciergeVehicleCard({
  vehicle,
  photoUrl,
  rating,
  ratingCount,
  reason,
}: {
  vehicle: ConciergeVehicle;
  photoUrl?: string | null;
  rating?: number | null;
  ratingCount?: number | null;
  reason?: string | null;
}) {
  const compare = useCompare();
  const isEv = /electric|ev/i.test(vehicle.fuel_type ?? "");

  return (
    <article className="w-[15.5rem] shrink-0 overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
      <Link to={`/cars/${vehicle.id}`} className="block">
        <div className="relative aspect-[4/3] bg-muted">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={`${vehicle.year} ${vehicle.make} ${vehicle.model} for rent${vehicle.location_label ? ` in ${vehicle.location_label}` : ""}`}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-accent/50 to-muted">
              <Car className="h-8 w-8 text-muted-foreground/30" aria-hidden="true" />
            </div>
          )}
          <div className="absolute bottom-2 left-2 rounded-lg bg-background/90 px-2 py-1 text-sm font-semibold backdrop-blur">
            {money(vehicle.base_daily_price_cents)}
            <span className="font-normal text-muted-foreground">/day</span>
          </div>
        </div>
      </Link>

      <div className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <Link to={`/cars/${vehicle.id}`} className="min-w-0">
            <h4 className="truncate text-sm font-bold">
              {vehicle.make} {vehicle.model}
            </h4>
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
              {vehicle.location_label || "Quebec"} · {vehicle.year}
            </p>
          </Link>
          {typeof rating === "number" && (
            <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium">
              <Star className="h-3 w-3 fill-current" aria-hidden="true" />
              {rating}
              {ratingCount ? <span className="text-muted-foreground">({ratingCount})</span> : null}
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {vehicle.seats ? <Spec icon={Users}>{vehicle.seats} seats</Spec> : null}
          {vehicle.fuel_type ? (
            <Spec icon={isEv ? Zap : Fuel}>{isEv ? "Electric" : vehicle.fuel_type}</Spec>
          ) : null}
          {vehicle.included_km_per_day ? (
            <Spec icon={Gauge}>{vehicle.included_km_per_day} km/day</Spec>
          ) : null}
        </div>

        {(vehicle.airport_pickup_enabled || vehicle.monthly_enabled) && (
          <div className="flex flex-wrap gap-1">
            {vehicle.airport_pickup_enabled && (
              <Tag>
                <Plane className="h-3 w-3" aria-hidden="true" /> Airport
              </Tag>
            )}
            {vehicle.monthly_enabled && (
              <Tag>
                <CalendarRange className="h-3 w-3" aria-hidden="true" /> Monthly
              </Tag>
            )}
          </div>
        )}

        {reason ? <p className="text-xs leading-snug text-muted-foreground">{reason}</p> : null}

        <div className="flex items-center gap-2 pt-1">
          <Button asChild size="sm" className="h-8 flex-1 rounded-lg text-xs">
            <Link to={`/cars/${vehicle.id}`}>View & book</Link>
          </Button>
          <label
            className={cn(
              "flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2 py-1.5 text-[11px] font-medium",
              compare.has(vehicle.id) && "border-primary/40 bg-primary/10 text-primary",
            )}
          >
            <Checkbox
              checked={compare.has(vehicle.id)}
              onCheckedChange={() => compare.toggle(vehicle)}
              aria-label={`Compare ${vehicle.make} ${vehicle.model}`}
              className="h-3.5 w-3.5"
            />
            Compare
          </label>
        </div>
      </div>
    </article>
  );
}

export function ConciergeVehicleRail({
  vehicles,
  heading,
}: {
  vehicles: ConciergeVehicle[];
  heading?: string;
}) {
  const { data: photos } = useCarPhotos(vehicles.map((v) => v.id));
  if (!vehicles.length) return null;

  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {heading ?? "Matching vehicles"}
        </h3>
        <span className="text-xs text-muted-foreground">{vehicles.length} found</span>
      </div>
      <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1">
        {vehicles.map((v) => (
          <div key={v.id} className="snap-start">
            <ConciergeVehicleCard vehicle={v} photoUrl={photos?.[v.id]} />
          </div>
        ))}
      </div>
    </section>
  );
}
