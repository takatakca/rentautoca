import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TripListSkeleton } from "@/components/ui/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Calendar, MapPin, Shield } from "lucide-react";
import { format } from "date-fns";

interface TripRow {
  id: string;
  car_id: string;
  start_at: string;
  end_at: string;
  status: string;
  total_cents: number | null;
  pickup_location: string | null;
  pricing_breakdown: any;
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

function bucketOf(t: TripRow): "upcoming" | "active" | "completed" | "cancelled" {
  if (t.status === "cancelled") return "cancelled";
  if (t.status === "completed") return "completed";
  const now = Date.now();
  const start = new Date(t.start_at).getTime();
  const end = new Date(t.end_at).getTime();
  if (start <= now && end >= now && t.status !== "draft") return "active";
  if (end < now) return "completed";
  return "upcoming";
}

export default function Trips() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trips, setTrips] = useState<TripRow[]>([]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      setError(null);
      const { data: tripRows, error: tErr } = await supabase
        .from("trips")
        .select("id, car_id, start_at, end_at, status, total_cents, pickup_location, pricing_breakdown")
        .eq("guest_id", user.id)
        .order("start_at", { ascending: false });

      if (tErr) {
        setError(tErr.message);
        setLoading(false);
        return;
      }

      const list = tripRows || [];
      const carIds = [...new Set(list.map((t) => t.car_id))];
      const carMap: Record<string, { make: string; model: string; year: number; title: string | null }> = {};
      const photoMap: Record<string, string> = {};

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

  const grouped = useMemo(() => {
    const g = { upcoming: [] as TripRow[], active: [] as TripRow[], completed: [] as TripRow[], cancelled: [] as TripRow[] };
    trips.forEach((t) => g[bucketOf(t)].push(t));
    return g;
  }, [trips]);

  if (loading) {
    return (
      <div className="container py-8 max-w-3xl mx-auto pb-24 md:pb-8">
        <TripListSkeleton count={3} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container py-8 max-w-3xl mx-auto pb-24 md:pb-8">
        <ErrorState
          title="Could not load your trips"
          description="We had trouble reaching the booking service. Check your connection and try again."
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-3xl mx-auto pb-24 md:pb-8">
      <h1 className="text-3xl font-bold mb-6">Your Trips</h1>

      {trips.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No trips yet"
          description="When you book a vehicle, your upcoming and past trips will appear here."
          action={{ label: "Browse cars", href: "/explore" }}
        />
      ) : (
        <Tabs defaultValue="upcoming" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="upcoming">Upcoming ({grouped.upcoming.length})</TabsTrigger>
            <TabsTrigger value="active">Active ({grouped.active.length})</TabsTrigger>
            <TabsTrigger value="completed">Past ({grouped.completed.length})</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled ({grouped.cancelled.length})</TabsTrigger>
          </TabsList>
          {(["upcoming", "active", "completed", "cancelled"] as const).map((k) => (
            <TabsContent key={k} value={k} className="space-y-3 mt-4">
              {grouped[k].length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No {k} trips.</p>
              ) : (
                grouped[k].map((t) => <TripCard key={t.id} t={t} />)
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}

function TripCard({ t }: { t: TripRow }) {
  const protection = t.pricing_breakdown?.protection_snapshot;
  return (
    <Link to={`/trips/${t.id}`}>
      <Card className="hover:border-primary/50 transition-colors">
        <CardContent className="p-4 flex gap-4">
          <div className="w-24 h-24 rounded-lg overflow-hidden bg-muted shrink-0">
            {t.photo_url && <img src={t.photo_url} alt="" className="w-full h-full object-cover" />}
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
            <div className="flex items-center justify-between mt-1">
              {protection && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Shield className="h-3 w-3" /> {protection.name}
                </span>
              )}
              {t.total_cents != null && (
                <p className="text-sm font-semibold">${(t.total_cents / 100).toFixed(2)} CAD</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
