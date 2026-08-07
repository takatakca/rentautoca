import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Navigation, Radio, ArrowRight, CalendarDays } from "lucide-react";
import { format } from "date-fns";

/**
 * "Track my rental" entry point.
 * - active trip  -> trip detail (live tracking lives there)
 * - no active    -> /trips
 * - signed out   -> /login with safe redirect
 * Never renders vehicle coordinates here.
 */
export function TrackRentalCard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: trip } = useQuery({
    queryKey: ["track-my-rental", user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("trips")
        .select("id, status, start_at, end_at, pickup_location, return_location, car_id, cars(make, model, year)")
        .in("status", ["active", "confirmed"])
        .order("start_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!data) return null;
      const { data: session } = await supabase
        .from("trip_tracking_sessions")
        .select("status")
        .eq("trip_id", data.id)
        .eq("status", "active")
        .maybeSingle();
      return { ...data, live: !!session };
    },
  });

  const go = () => {
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent("/trips")}`);
      return;
    }
    navigate(trip ? `/trips/${trip.id}` : "/trips");
  };

  const car = trip?.cars as { make: string; model: string; year: number } | null | undefined;

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="w-9 h-9 rounded-xl bg-accent text-accent-foreground flex items-center justify-center">
            <Navigation className="h-4 w-4" aria-hidden="true" />
          </span>
          <h3 className="font-semibold">Track my rental</h3>
        </div>
        {trip?.live && (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary">
            <Radio className="h-3 w-3 motion-safe:animate-pulse" aria-hidden="true" />
            LIVE
          </span>
        )}
      </div>

      {trip && car ? (
        <div className="mt-3 text-sm">
          <p className="font-medium">{car.year} {car.make} {car.model}</p>
          <p className="text-muted-foreground mt-0.5 capitalize">{trip.status} trip</p>
          <p className="text-muted-foreground mt-1 flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            {format(new Date(trip.start_at), "MMM d, HH:mm")} → {format(new Date(trip.end_at), "MMM d, HH:mm")}
          </p>
          {trip.pickup_location && (
            <p className="text-muted-foreground mt-0.5 truncate">Pickup · {trip.pickup_location}</p>
          )}
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          {user
            ? "No active rental right now. Your trips and live tracking appear here once a booking starts."
            : "Sign in to see your current rental, pickup details and live tracking during the trip."}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={go} className="rounded-full gap-1.5">
          {trip ? "Open trip" : user ? "View my trips" : "Sign in to track"}
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
        <Button asChild variant="outline" className="rounded-full">
          <Link to="/tracking">How tracking works</Link>
        </Button>
      </div>
    </div>
  );
}
