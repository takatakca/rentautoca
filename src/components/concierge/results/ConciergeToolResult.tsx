import type { ComponentProps } from "react";
import { ConciergeVehicleRail, type ConciergeVehicle } from "./ConciergeVehicleCard";
import { ConciergeVehicleCard } from "./ConciergeVehicleCard";
import { ConciergeQuoteCard } from "./ConciergeQuoteCard";
import { ConciergeProtectionCards, ConciergePolicyCards } from "./ConciergeProtectionCards";
import { ConciergeTripCards } from "./ConciergeTripCards";
import { useCarPhotos } from "@/hooks/use-car-photos";

function SingleVehicle({
  vehicle,
  rating,
  ratingCount,
}: {
  vehicle: ConciergeVehicle;
  rating?: number | null;
  ratingCount?: number | null;
}) {
  const { data: photos } = useCarPhotos([vehicle.id]);
  return (
    <div className="flex">
      <ConciergeVehicleCard
        vehicle={vehicle}
        photoUrl={photos?.[vehicle.id]}
        rating={rating}
        ratingCount={ratingCount}
      />
    </div>
  );
}

/**
 * Turns a completed tool result into a structured Rentauto UI block.
 * Returns null for tools that only inform the written answer.
 */
export function ConciergeToolResult({
  toolName,
  input,
  output,
}: {
  toolName: string;
  input?: unknown;
  output: unknown;
}) {
  type ToolResult = ComponentProps<typeof ConciergeQuoteCard>["quote"] & {
    vehicles?: ConciergeVehicle[];
    vehicle?: ConciergeVehicle;
    rating_avg?: number | null;
    rating_count?: number | null;
    plans?: ComponentProps<typeof ConciergeProtectionCards>["plans"];
    policies?: ComponentProps<typeof ConciergePolicyCards>["policies"];
    trips?: ComponentProps<typeof ConciergeTripCards>["trips"];
  };
  const o = output as ToolResult | null;
  if (!o || typeof o !== "object" || o.error) return null;

  switch (toolName) {
    case "search_vehicles":
      return <ConciergeVehicleRail vehicles={(o.vehicles ?? []) as ConciergeVehicle[]} />;
    case "get_vehicle":
      return o.vehicle ? (
        <SingleVehicle
          vehicle={o.vehicle as ConciergeVehicle}
          rating={o.rating_avg}
          ratingCount={o.rating_count}
        />
      ) : null;
    case "quote_trip":
      return (
        <ConciergeQuoteCard
          quote={o}
          carId={
            typeof input === "object" && input !== null &&
            "carId" in input && typeof input.carId === "string"
              ? input.carId
              : undefined
          }
        />
      );
    case "list_protection_plans":
      return <ConciergeProtectionCards plans={o.plans ?? []} />;
    case "list_cancellation_policies":
      return <ConciergePolicyCards policies={o.policies ?? []} />;
    case "my_trips":
      return <ConciergeTripCards trips={o.trips ?? []} />;
    default:
      return null;
  }
}

export const TOOL_STATUS: Record<string, string> = {
  search_vehicles: "Searching available vehicles",
  get_vehicle: "Opening vehicle details",
  quote_trip: "Calculating your exact price",
  list_protection_plans: "Reviewing protection options",
  list_cancellation_policies: "Checking cancellation terms",
  platform_knowledge: "Checking Rentauto policy",
  my_trips: "Looking up your bookings",
};
