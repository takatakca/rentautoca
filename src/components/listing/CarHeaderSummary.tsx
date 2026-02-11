import { Star, Award } from "lucide-react";
import type { CarListing } from "@/hooks/use-car-listing";

interface Props {
  car: CarListing;
}

export function CarHeaderSummary({ car }: Props) {
  return (
    <div className="px-4 py-5">
      <h1 className="text-2xl font-bold">
        {car.make} {car.model} {car.year}
      </h1>
      {car.trim && <p className="text-muted-foreground">{car.trim}</p>}
      <div className="flex items-center gap-2 mt-2 text-sm">
        {car.rating_avg !== null && (
          <>
            <span className="font-bold text-lg">{car.rating_avg.toFixed(1)}</span>
            <Star className="h-4 w-4 fill-primary text-primary" />
            <span className="text-muted-foreground">({car.rating_count} trips)</span>
          </>
        )}
        {car.host?.is_all_star && (
          <span className="flex items-center gap-1 text-primary ml-2">
            <Award className="h-4 w-4" />
            <span className="font-semibold">All-Star Host</span>
          </span>
        )}
      </div>
    </div>
  );
}
