import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { SafeImage } from "@/components/ui/safe-image";
import { Car, Calendar, DollarSign, Plus, ArrowRight, Pencil, Activity, AlertTriangle, Camera, Cpu } from "lucide-react";
import { DashboardSkeleton } from "@/components/ui/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { StripeStatusCard } from "@/components/host/StripeStatusCard";
import { useHostCompletion } from "@/hooks/use-host-completion";
import { format } from "date-fns";

interface HostCar {
  id: string; title: string; make: string; model: string; year: number;
  status: string; base_daily_price_cents: number; location_label: string | null;
  photo_url: string | null;
}
interface HostBooking {
  id: string; start_at: string; end_at: string; status: string; total_cents: number | null;
  car_id: string; car_label: string;
}

export default function HostDashboard() {
  const completion = useHostCompletion();
  const { user } = useAuth();
  const [cars, setCars] = useState<HostCar[]>([]);
  const [bookings, setBookings] = useState<HostBooking[]>([]);
  const [earnings, setEarnings] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data: carRows } = await supabase
        .from("cars")
        .select("id, title, make, model, year, status, base_daily_price_cents, location_label")
        .eq("host_id", user.id)
        .order("created_at", { ascending: false });

      const carIds = (carRows || []).map((c) => c.id);
      const photoMap: Record<string, string> = {};
      if (carIds.length) {
        const { data: photos } = await supabase
          .from("car_photos").select("car_id, url").in("car_id", carIds).order("sort_order");
        (photos || []).forEach((p) => { if (!photoMap[p.car_id]) photoMap[p.car_id] = p.url; });
      }
      setCars((carRows || []).map((c) => ({ ...c, photo_url: photoMap[c.id] ?? null })));

      if (carIds.length) {
        const { data: tripRows } = await supabase
          .from("trips")
          .select("id, start_at, end_at, status, total_cents, car_id")
          .in("car_id", carIds)
          .order("start_at", { ascending: true });
        const carLabels: Record<string, string> = {};
        (carRows || []).forEach((c) => { carLabels[c.id] = `${c.year} ${c.make} ${c.model}`; });
        const list = (tripRows || []).map((t) => ({ ...t, car_label: carLabels[t.car_id] || "Vehicle" }));
        setBookings(list);
        const earned = list.filter((t) => ["confirmed", "completed"].includes(t.status))
          .reduce((s, t) => s + (t.total_cents || 0), 0);
        setEarnings(earned);
      }
      setLoading(false);
    })();
  }, [user]);

  const upcoming = bookings.filter((b) => new Date(b.end_at) >= new Date() && b.status !== "cancelled" && b.status !== "draft");
  const activeCars = cars.filter((c) => c.status === "active").length;

  return (
    <div className="container py-8 pb-24 md:pb-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Host Dashboard</h1>
        <Button asChild>
          <Link to="/host/cars"><Plus className="h-4 w-4 mr-2" />Manage vehicles</Link>
        </Button>
      </div>

      {!completion.isLoading && completion.percentage < 100 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-center justify-between py-4 gap-4">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm mb-2">Profile {completion.percentage}% complete</p>
              <Progress value={completion.percentage} className="h-2" />
            </div>
            <Button asChild variant="outline" size="sm" className="shrink-0">
              <Link to="/host/onboarding">Continue Setup<ArrowRight className="ml-1 h-3 w-3" /></Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid sm:grid-cols-3 gap-6">
        <StatCard icon={DollarSign} label="Total earnings" value={`$${(earnings / 100).toFixed(2)} CAD`} sub="Confirmed + completed" />
        <StatCard icon={Car} label="Active listings" value={String(activeCars)} sub={`${cars.length} total`} />
        <StatCard icon={Calendar} label="Upcoming bookings" value={String(upcoming.length)} sub="Next 90 days" />
      </div>

      <StripeStatusCard />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Your vehicles</CardTitle>
            <CardDescription>{loading ? "Loading…" : cars.length === 0 ? "You haven't listed any vehicles yet." : `${cars.length} vehicle${cars.length === 1 ? "" : "s"}`}</CardDescription>
          </div>
          <Button asChild variant="outline" size="sm"><Link to="/host/cars">View all</Link></Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {cars.slice(0, 4).map((c) => (
            <Link key={c.id} to={`/host/cars/${c.id}/edit`} className="flex gap-3 items-center hover:bg-muted/50 rounded-lg p-2 -mx-2 transition-colors">
              <SafeImage src={c.photo_url ?? undefined} className="w-16 h-16 rounded-md shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{c.year} {c.make} {c.model}</p>
                <p className="text-xs text-muted-foreground truncate">{c.location_label || "—"} · ${(c.base_daily_price_cents / 100).toFixed(0)}/day</p>
              </div>
              <Badge variant={c.status === "active" ? "default" : "secondary"} className="capitalize">{c.status}</Badge>
              <Pencil className="h-4 w-4 text-muted-foreground" />
            </Link>
          ))}
        </CardContent>
      </Card>

      <ActiveRentalsSection carIds={cars.map((c) => c.id)} />

      <Card>
        <CardHeader>
          <CardTitle>Bookings</CardTitle>
          <CardDescription>Reservations for your vehicles</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {bookings.length === 0 && <p className="text-sm text-muted-foreground">No bookings yet.</p>}
          {bookings.slice(0, 8).map((b) => (
            <div key={b.id} className="flex items-center justify-between text-sm border-b border-border pb-2 last:border-0">
              <div className="min-w-0">
                <p className="font-medium truncate">{b.car_label}</p>
                <p className="text-xs text-muted-foreground">{format(new Date(b.start_at), "MMM d")} → {format(new Date(b.end_at), "MMM d")}</p>
              </div>
              <div className="text-right shrink-0">
                <Badge variant="outline" className="capitalize">{b.status.replace("_", " ")}</Badge>
                <p className="text-xs text-muted-foreground mt-1">${((b.total_cents || 0) / 100).toFixed(0)}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}

function ActiveRentalsSection({ carIds }: { carIds: string[] }) {
  const [sessions, setSessions] = useState<any[]>([]);
  useEffect(() => {
    if (carIds.length === 0) { setSessions([]); return; }
    supabase
      .from("trip_tracking_sessions")
      .select("id, trip_id, car_id, status, started_at")
      .in("car_id", carIds)
      .eq("status", "active")
      .then(({ data }) => setSessions(data || []));
  }, [carIds.join(",")]);

  if (sessions.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Active rentals</CardTitle>
        <CardDescription>{sessions.length} vehicle{sessions.length === 1 ? "" : "s"} currently out</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {sessions.map((s) => (
          <div key={s.id} className="flex items-center justify-between text-sm">
            <span>Trip {String(s.trip_id).slice(0, 8)}…</span>
            <Button asChild size="sm" variant="outline"><Link to={`/trips/${s.trip_id}`}>View live</Link></Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

