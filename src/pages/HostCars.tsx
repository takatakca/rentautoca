import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SafeImage } from "@/components/ui/safe-image";
import { useToast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/ui/empty-state";
import { Car, Pencil, Power, PowerOff, ArrowLeft } from "lucide-react";

interface HostCar {
  id: string; title: string; make: string; model: string; year: number;
  status: string; base_daily_price_cents: number; location_label: string | null;
  photo_url: string | null;
}

export default function HostCars() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [cars, setCars] = useState<HostCar[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data: carRows } = await supabase
      .from("cars")
      .select("id, title, make, model, year, status, base_daily_price_cents, location_label")
      .eq("host_id", user.id)
      .order("created_at", { ascending: false });
    const ids = (carRows || []).map((c) => c.id);
    const photoMap: Record<string, string> = {};
    if (ids.length) {
      const { data: photos } = await supabase.from("car_photos").select("car_id, url").in("car_id", ids).order("sort_order");
      (photos || []).forEach((p) => { if (!photoMap[p.car_id]) photoMap[p.car_id] = p.url; });
    }
    setCars((carRows || []).map((c) => ({ ...c, photo_url: photoMap[c.id] ?? null })));
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const toggle = async (id: string, status: string) => {
    const next = status === "active" ? "paused" : "active";
    const { error } = await supabase.from("cars").update({ status: next }).eq("id", id);
    if (error) toast({ title: "Could not update", description: error.message, variant: "destructive" });
    else { toast({ title: `Vehicle ${next}` }); load(); }
  };

  return (
    <div className="container py-8 max-w-4xl pb-24 md:pb-8 space-y-4">
      <Link to="/host" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>
      <h1 className="text-3xl font-bold">Your vehicles</h1>

      {loading ? (
        Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)
      ) : cars.length === 0 ? (
        <Card><CardHeader><CardTitle>No vehicles yet</CardTitle></CardHeader>
          <CardContent><p className="text-muted-foreground">Add your first vehicle from your host onboarding.</p></CardContent>
        </Card>
      ) : (
        cars.map((c) => (
          <Card key={c.id}>
            <CardContent className="p-4 flex gap-4 items-center">
              <SafeImage src={c.photo_url ?? undefined} className="w-24 h-24 rounded-lg shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold truncate">{c.year} {c.make} {c.model}</h3>
                  <Badge variant={c.status === "active" ? "default" : "secondary"} className="capitalize">{c.status}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{c.location_label || "—"} · ${(c.base_daily_price_cents / 100).toFixed(0)}/day</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => toggle(c.id, c.status)}>
                  {c.status === "active" ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                  <span className="hidden sm:inline">{c.status === "active" ? "Pause" : "Activate"}</span>
                </Button>
                <Button asChild size="sm">
                  <Link to={`/host/cars/${c.id}/edit`}><Pencil className="h-4 w-4" /><span className="hidden sm:inline">Edit</span></Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
