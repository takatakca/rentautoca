import { useCompare } from "./compare-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Link } from "react-router-dom";
import { X, Columns3 } from "lucide-react";

const rows: { label: string; get: (v: any) => string }[] = [
  { label: "Daily price", get: (v) => `$${Math.round(v.base_daily_price_cents / 100)}` },
  { label: "Year", get: (v) => String(v.year ?? "—") },
  { label: "Seats", get: (v) => String(v.seats ?? "—") },
  { label: "Fuel", get: (v) => v.fuel_type ?? "—" },
  { label: "Transmission", get: (v) => v.transmission ?? "—" },
  { label: "Km / day", get: (v) => (v.included_km_per_day ? `${v.included_km_per_day} km` : "—") },
  { label: "Location", get: (v) => v.location_label ?? "—" },
];

export function CompareBar() {
  const { items, clear, toggle } = useCompare();
  if (items.length === 0) return null;

  return (
    <div className="flex items-center gap-2 border-t border-border bg-secondary/50 px-3 py-2">
      <span className="text-xs font-medium">
        {items.length} vehicle{items.length === 1 ? "" : "s"} selected
      </span>
      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={clear}>
          Clear
        </Button>
        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm" className="h-8 rounded-lg text-xs" disabled={items.length < 2}>
              <Columns3 className="mr-1 h-3.5 w-3.5" /> Compare
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Side-by-side comparison</DialogTitle>
            </DialogHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="w-28" />
                    {items.map((v) => (
                      <th key={v.id} className="p-2 text-left align-top">
                        <Link to={`/cars/${v.id}`} className="font-semibold hover:underline">
                          {v.make} {v.model}
                        </Link>
                        <button
                          onClick={() => toggle(v)}
                          aria-label={`Remove ${v.make} ${v.model} from comparison`}
                          className="ml-1 text-muted-foreground hover:text-destructive"
                        >
                          <X className="inline h-3 w-3" />
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.label} className="border-t border-border">
                      <td className="p-2 text-xs font-medium text-muted-foreground">{r.label}</td>
                      {items.map((v) => (
                        <td key={v.id} className="p-2">
                          {r.get(v)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
