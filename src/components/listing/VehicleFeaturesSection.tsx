import { Armchair, Fuel, Gauge, Settings } from "lucide-react";
import type { CarListing } from "@/hooks/use-car-listing";

interface Props {
  car: CarListing;
}

const fuelLabels: Record<string, string> = {
  regular: "Gas (Regular)",
  premium: "Gas (Premium)",
  diesel: "Diesel",
  electric: "Electric",
  hybrid: "Hybrid",
};

export function VehicleFeaturesSection({ car }: Props) {
  const chips = [
    { icon: Armchair, label: `${car.seats} seats` },
    { icon: Fuel, label: fuelLabels[car.fuel_type] || car.fuel_type },
    ...(car.consumption_l_per_100km
      ? [{ icon: Gauge, label: `${car.consumption_l_per_100km} L/100km` }]
      : []),
    { icon: Settings, label: `${car.transmission.charAt(0).toUpperCase() + car.transmission.slice(1)} transmission` },
  ];

  return (
    <div className="px-4 py-6">
      <h2 className="text-xl font-bold mb-4">Vehicle features</h2>

      {/* Chips */}
      <div className="flex flex-wrap gap-2 mb-6">
        {chips.map((chip, i) => (
          <div
            key={i}
            className="flex items-center gap-2 bg-secondary text-secondary-foreground px-3 py-2 rounded-lg text-sm"
          >
            <chip.icon className="h-4 w-4" />
            <span>{chip.label}</span>
          </div>
        ))}
      </div>

      {/* Safety */}
      {car.features.safety.length > 0 && (
        <>
          <h3 className="font-semibold mb-2">Safety</h3>
          <div className="space-y-1 mb-4">
            {car.features.safety.map((f, i) => (
              <p key={i} className="text-sm">{f}</p>
            ))}
          </div>
        </>
      )}

      {/* Connectivity */}
      {car.features.connectivity.length > 0 && (
        <>
          <h3 className="font-semibold mb-2">Device connectivity</h3>
          <div className="space-y-1">
            {car.features.connectivity.map((f, i) => (
              <p key={i} className="text-sm">{f}</p>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
