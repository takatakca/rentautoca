import { Car, Users, Clock, Sparkles, LifeBuoy, Phone } from "lucide-react";

export function IncludedInPriceCard() {
  return (
    <div className="px-4 py-6">
      <h2 className="text-xl font-bold mb-4">Included in the Price</h2>

      <h3 className="font-semibold mb-3">Convenience</h3>
      <div className="space-y-4 mb-6">
        <div className="flex items-start gap-3">
          <Car className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Skip the rental counter</p>
            <p className="text-muted-foreground text-sm">Use the app for pickup and return instructions</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Users className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
          <p className="font-medium">Add additional drivers for free</p>
        </div>
        <div className="flex items-start gap-3">
          <Clock className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">30-minute return grace period</p>
            <p className="text-sm text-success">
              No need to extend your trip unless you're running more than 30 minutes late
            </p>
          </div>
        </div>
      </div>

      <h3 className="font-semibold mb-3">Peace of mind</h3>
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
          <p className="font-medium">
            No need to wash the car before returning it, but please keep the vehicle tidy.
          </p>
        </div>
        <div className="flex items-start gap-3">
          <LifeBuoy className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
          <p className="font-medium">Access to basic roadside assistance</p>
        </div>
        <div className="flex items-start gap-3">
          <Phone className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
          <p className="font-medium">24/7 customer support</p>
        </div>
      </div>
    </div>
  );
}
