import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useCarPhotos } from "@/hooks/use-car-photos";
import { VehicleCard } from "@/components/vehicle/VehicleCard";
import { toPublicVehicle } from "@/lib/vehicle-presentation";
import { useCompare, type CompareVehicle } from "./compare-context";
import { cn } from "@/lib/utils";

export interface ConciergeVehicle extends CompareVehicle {
  title?: string | null;
  doors?: number | null;
  body_type?: string | null;
  airport_pickup_enabled?: boolean | null;
  monthly_enabled?: boolean | null;
  instant_book?: boolean | null;
  consumption_l_per_100km?: number | null;
}

/**
 * Concierge results reuse the canonical Rentauto vehicle card (compact
 * variant) and only add assistant-specific actions underneath.
 */
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

  return (
    <VehicleCard
      variant="compact"
      car={toPublicVehicle({
        ...vehicle,
        photo_url: photoUrl ?? null,
        rating: rating ?? null,
        trips: ratingCount ?? null,
      })}
      footer={
        <div className="space-y-2">
          {reason ? <p className="text-xs leading-snug text-muted-foreground">{reason}</p> : null}
          <div className="flex items-center gap-2">
            <Button asChild size="sm" className="h-8 flex-1 rounded-lg text-xs">
              <Link to={`/cars/${vehicle.id}`}>View &amp; book</Link>
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
      }
    />
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
