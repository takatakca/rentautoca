import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface TripRow {
  id: string;
  car_id: string;
  start_at: string;
  end_at: string;
  status: string;
  total_cents: number | null;
  pickup_location: string | null;
  car: { make: string; model: string; year: number; title: string | null } | null;
  photo_url: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  quote: "Quote",
  pending_payment: "Pending payment",
  confirmed: "Confirmed",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default function Trips() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState<TripRow[]>([]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: tripRows } = await supabase
        .from("trips")
        .select("id, car_id, start_at, end_at, status, total_cents, pickup_location")
        .eq("guest_id", user.id)
        .order("created_at", { ascending: false });

      const list = tripRows || [];
      const carIds = [...new Set(list.map((t) => t.car_id))];
      let carMap: Record<string, { make: string; model: string; year: number; title: string | null }> = {};
      let photoMap: Record<string, string> = {};

      if (carIds.length) {
        const [carsRes, photosRes] = await Promise.all([
          supabase.from("cars").select("id, make, model, year, title").in("id", carIds),
          supabase.from("car_photos").select("car_id, url").in("car_id", carIds).order("sort_order"),
        ]);
        (carsRes.data || []).forEach((c) => {
          carMap[c.id] = { make: c.make, model: c.model, year: c.year, title: c.title };
        });
        (photosRes.data || []).forEach((p) => {
          if (!photoMap[p.car_id]) photoMap[p.car_id] = p.url;
        });
      }

      setTrips(
        list.map((t) => ({
          ...t,
          car: carMap[t.car_id] ?? null,
          photo_url: photoMap[t.car_id] ?? null,
        })),
      );
      setLoading(false);
    };
    load();
  }, [user]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-3xl mx-auto pb-24 md:pb-8">
      <h1 className="text-3xl font-bold mb-6">Your Trips</h1>

      {trips.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              No trips yet
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              When you book a vehicle, your upcoming and past trips will appear here.
            </p>
            <Button asChild>
              <Link to="/explore">Browse cars</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {trips.map((t) => (
            <Link key={t.id} to={`/cars/${t.car_id}`}>
              <Card className="hover:border-primary/50 transition-colors">
                <CardContent className="p-4 flex gap-4">
                  <div className="w-24 h-24 rounded-lg overflow-hidden bg-muted shrink-0">
                    {t.photo_url && (
                      <img src={t.photo_url} alt="" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold truncate">
                        {t.car ? `${t.car.make} ${t.car.model} ${t.car.year}` : "Vehicle"}
                      </h3>
                      <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary capitalize whitespace-nowrap">
                        {STATUS_LABEL[t.status] ?? t.status}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {format(new Date(t.start_at), "MMM d")} → {format(new Date(t.end_at), "MMM d, yyyy")}
                    </p>
                    {t.pickup_location && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {t.pickup_location}
                      </p>
                    )}
                    {t.total_cents != null && (
                      <p className="text-sm font-semibold mt-1">
                        ${(t.total_cents / 100).toFixed(2)} CAD
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
