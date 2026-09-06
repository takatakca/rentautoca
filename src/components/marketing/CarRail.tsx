import { Link } from "react-router-dom";
import { VehicleCard } from "@/components/vehicle/VehicleCard";
import { toPublicVehicle } from "@/lib/vehicle-presentation";
import type { DiscoveryCar } from "@/hooks/use-discovery-inventory";

/** Homepage inventory card — canonical VehicleCard in its rail variant. */
export function DiscoveryCarCard({ car }: { car: DiscoveryCar }) {
  return <VehicleCard variant="rail" car={toPublicVehicle(car)} />;
}

export function CarRail({
  title,
  subtitle,
  cars,
  seeAllHref,
  tripDays,
}: {
  title: string;
  subtitle?: string;
  cars: DiscoveryCar[];
  seeAllHref?: string;
  tripDays?: number | null;
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
            <VehicleCard variant="rail" car={toPublicVehicle(car)} tripDays={tripDays} />
          </li>
        ))}
      </ul>
    </section>
  );
}
