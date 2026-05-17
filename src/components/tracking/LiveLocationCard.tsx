import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, Activity, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  tripId: string;
  showRoute?: boolean;
}

export function LiveLocationCard({ tripId, showRoute = false }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["live-location", tripId, showRoute],
    queryFn: async () => {
      const { data: events } = await supabase
        .from("vehicle_location_events")
        .select("lat, lng, speed_kmh, heading, recorded_at, accuracy_meters")
        .eq("trip_id", tripId)
        .order("recorded_at", { ascending: false })
        .limit(showRoute ? 50 : 1);
      return events || [];
    },
    refetchInterval: 20000,
  });

  const last = data?.[0];

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Activity className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-sm">Live vehicle location</h3>
      </div>

      {isLoading ? (
        <div className="p-4 space-y-2">
          <Skeleton className="aspect-[16/9] w-full rounded-lg" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ) : !last ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          <MapPin className="h-8 w-8 mx-auto mb-2 opacity-40" />
          Waiting for first location ping. Tracking activates after check-in.
        </div>
      ) : (
        <>
          <div className="relative aspect-[16/9] bg-muted">
            <iframe
              title="Vehicle location"
              className="w-full h-full"
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${Number(last.lng) - 0.01}%2C${Number(last.lat) - 0.01}%2C${Number(last.lng) + 0.01}%2C${Number(last.lat) + 0.01}&layer=mapnik&marker=${last.lat}%2C${last.lng}`}
              loading="lazy"
            />
          </div>
          <div className="p-4 space-y-1 text-sm">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="font-mono text-xs">
                {Number(last.lat).toFixed(5)}, {Number(last.lng).toFixed(5)}
              </span>
            </div>
            {last.speed_kmh != null && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Activity className="h-4 w-4" /> {Number(last.speed_kmh).toFixed(0)} km/h
              </div>
            )}
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" /> Updated {formatDistanceToNow(new Date(last.recorded_at), { addSuffix: true })}
            </div>
            {showRoute && data && data.length > 1 && (
              <p className="text-xs text-muted-foreground pt-2 border-t border-border mt-2">
                {data.length} location pings in this trip
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
