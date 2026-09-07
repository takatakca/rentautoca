import { MapPin, Star } from "lucide-react";
import type { CarListing } from "@/hooks/use-car-listing";

/** Editorial vehicle identity block: title, credibility, and key facts. */
export function VehicleIdentity({ car }: { car: CarListing }) {
  const facts = [
    car.body_type,
    car.seats ? `${car.seats} seats` : null,
    car.transmission,
    car.fuel_type,
    car.doors ? `${car.doors} doors` : null,
  ].filter((f): f is string => Boolean(f));

  return (
    <section className="space-y-3">
      <div>
        <h1 className="text-3xl font-bold leading-tight tracking-tight md:text-4xl">
          {car.year} {car.make} {car.model}
        </h1>
        {car.trim && <p className="mt-1 text-lg text-muted-foreground">{car.trim}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {car.rating_avg !== null && (
          <span className="flex items-center gap-1 font-medium">
            <Star className="h-4 w-4 fill-primary text-primary" aria-hidden="true" />
            {car.rating_avg.toFixed(1)}
            <span className="text-muted-foreground">({car.rating_count})</span>
          </span>
        )}
        {car.host?.trips_count ? (
          <span className="text-muted-foreground">{car.host.trips_count} trips</span>
        ) : null}
        {car.location_label && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <MapPin className="h-4 w-4" aria-hidden="true" /> {car.location_label}
          </span>
        )}
      </div>

      {facts.length > 0 && (
        <dl className="flex flex-wrap items-center gap-x-6 gap-y-1 border-y border-border py-3 text-sm capitalize">
          {facts.map((f) => (
            <div key={f}>
              <dd className="font-medium">{f}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
