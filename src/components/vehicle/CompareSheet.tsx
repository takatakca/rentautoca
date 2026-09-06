import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { PublicVehicle } from "@/components/vehicle/VehicleCard";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  vehicles: PublicVehicle[];
  tripDays?: number | null;
}

const ROWS: { label: string; get: (v: PublicVehicle, days: number | null) => string | null }[] = [
  { label: "Daily price", get: (v) => `$${(v.base_daily_price_cents / 100).toFixed(0)}` },
  {
    label: "Trip estimate",
    get: (v, days) => (days ? `$${((v.base_daily_price_cents / 100) * days).toFixed(0)}` : null),
  },
  { label: "Seats", get: (v) => (v.seats ? `${v.seats}` : null) },
  { label: "Transmission", get: (v) => v.transmission ?? null },
  { label: "Fuel", get: (v) => v.fuel_type ?? null },
  { label: "Included km/day", get: (v) => (v.included_km_per_day ? `${v.included_km_per_day} km` : null) },
  { label: "Airport pickup", get: (v) => (v.airport_pickup_enabled ? "Yes" : "No") },
  { label: "Monthly", get: (v) => (v.monthly_enabled ? "Yes" : "No") },
  { label: "Rating", get: (v) => (v.rating != null ? `${v.rating}` : null) },
];

export function CompareSheet({ open, onOpenChange, vehicles, tripDays }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Compare vehicles</SheetTitle>
        </SheetHeader>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[32rem] text-sm">
            <caption className="sr-only">Side-by-side vehicle comparison</caption>
            <thead>
              <tr>
                <th scope="col" className="w-32 text-left text-xs font-medium text-muted-foreground">
                  Vehicle
                </th>
                {vehicles.map((v) => (
                  <th key={v.id} scope="col" className="p-2 text-left align-bottom">
                    <div className="aspect-[4/3] w-full overflow-hidden rounded-lg bg-muted">
                      {v.photo_url && (
                        <img
                          src={v.photo_url}
                          alt={`${v.year} ${v.make} ${v.model}`}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <span className="mt-1.5 block text-sm font-semibold leading-tight">
                      {v.year} {v.make} {v.model}
                    </span>
                    <span className="block text-xs font-normal text-muted-foreground">
                      {v.location_label ?? ""}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => {
                const cells = vehicles.map((v) => row.get(v, tripDays ?? null));
                if (cells.every((c) => c == null)) return null;
                return (
                  <tr key={row.label} className="border-t border-border">
                    <th scope="row" className="py-2 pr-2 text-left text-xs font-medium text-muted-foreground">
                      {row.label}
                    </th>
                    {cells.map((c, i) => (
                      <td key={vehicles[i].id} className="p-2 font-medium">
                        {c ?? "—"}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SheetContent>
    </Sheet>
  );
}
