import { CalendarDays, MapPin, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, addDays } from "date-fns";

interface Props {
  location: string | null;
}

export function TripSection({ location }: Props) {
  const startDate = addDays(new Date(), 7);
  const endDate = addDays(startDate, 3);

  return (
    <div className="px-4 py-6">
      <h2 className="text-xl font-bold mb-4">Your trip</h2>

      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3">
          <CalendarDays className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div>
            <p className="font-semibold">Trip dates</p>
            <p className="text-muted-foreground text-sm">
              {format(startDate, "EEE, MMM d, HH:mm")}
            </p>
            <p className="text-muted-foreground text-sm">
              {format(endDate, "EEE, MMM d, HH:mm")}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="rounded-full border border-border">
          <Pencil className="h-4 w-4" />
        </Button>
      </div>

      <div className="border-t border-border pt-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="font-semibold">Pickup & return location</p>
              <p className="text-muted-foreground text-sm">{location || "Location TBD"}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="rounded-full border border-border">
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
