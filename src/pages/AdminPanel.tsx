import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardSkeleton } from "@/components/ui/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { Users, Car, Calendar, Activity, AlertTriangle, Camera, Cpu } from "lucide-react";

export default function AdminPanel() {
  const [stats, setStats] = useState({
    users: 0, cars: 0, trips: 0, activeTrips: 0,
    pendingCheckIns: 0, activeSessions: 0,
    carsWithoutPhotos: 0, carsWithoutDevices: 0,
  });
  const [activeTrips, setActiveTrips] = useState<any[]>([]);
  const [pendingCheckIns, setPendingCheckIns] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [u, c, t, at, pci, ats, cwp, cwd, inc] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("cars").select("*", { count: "exact", head: true }),
        supabase.from("trips").select("*", { count: "exact", head: true }),
        supabase.from("trips").select("*", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("trips").select("id, status, start_at, car_id, guest_id").in("status", ["confirmed", "check_in_pending"]).order("start_at").limit(10),
        supabase.from("trip_tracking_sessions").select("id, trip_id, car_id, started_at").eq("status", "active"),
        supabase.from("cars").select("id"),
        supabase.from("vehicle_tracking_devices").select("car_id"),
        supabase.from("trip_incidents").select("id, trip_id, type, status, created_at").eq("status", "open").order("created_at", { ascending: false }).limit(10),
      ]);

      const allCarIds = (cwp.data || []).map((x: any) => x.id);
      const devicedIds = new Set((cwd.data || []).map((x: any) => x.car_id));

      // Count cars without photos
      let carsWithoutPhotos = 0;
      if (allCarIds.length) {
        const { data: phs } = await supabase.from("car_photos").select("car_id").in("car_id", allCarIds);
        const withPhotos = new Set((phs || []).map((p: any) => p.car_id));
        carsWithoutPhotos = allCarIds.filter((id) => !withPhotos.has(id)).length;
      }

      setStats({
        users: u.count || 0, cars: c.count || 0, trips: t.count || 0,
        activeTrips: at.count || 0,
        pendingCheckIns: (pci.data || []).length,
        activeSessions: (ats.data || []).length,
        carsWithoutPhotos,
        carsWithoutDevices: allCarIds.filter((id) => !devicedIds.has(id)).length,
      });
      setActiveTrips(ats.data || []);
      setPendingCheckIns(pci.data || []);
      setIncidents(inc.data || []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="container py-8 pb-24 md:pb-8">
      <h1 className="text-3xl font-bold mb-6">Admin Control Center</h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-8">
        <Stat icon={Users} label="Users" value={stats.users} />
        <Stat icon={Car} label="Cars" value={stats.cars} />
        <Stat icon={Calendar} label="Trips" value={stats.trips} />
        <Stat icon={Activity} label="Active trips" value={stats.activeTrips} />
        <Stat icon={AlertTriangle} label="Pending check-ins" value={stats.pendingCheckIns} />
        <Stat icon={Activity} label="Active tracking sessions" value={stats.activeSessions} />
        <Stat icon={Camera} label="Cars without photos" value={stats.carsWithoutPhotos} />
        <Stat icon={Cpu} label="Cars without tracking devices" value={stats.carsWithoutDevices} />
      </div>

      <Tabs defaultValue="active">
        <TabsList className="w-full overflow-x-auto justify-start">
          <TabsTrigger value="active">Active rentals</TabsTrigger>
          <TabsTrigger value="checkins">Pending check-ins</TabsTrigger>
          <TabsTrigger value="incidents">Open incidents</TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          <Card><CardHeader><CardTitle>Active tracking sessions</CardTitle><CardDescription>Vehicles currently out on rentals.</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              {activeTrips.length === 0 && <p className="text-sm text-muted-foreground">No active rentals.</p>}
              {activeTrips.map((s) => (
                <div key={s.id} className="flex items-center justify-between text-sm border-b border-border pb-2 last:border-0">
                  <span>Trip {String(s.trip_id).slice(0, 8)}…</span>
                  <Button asChild size="sm" variant="outline"><Link to={`/trips/${s.trip_id}`}>View</Link></Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="checkins">
          <Card><CardHeader><CardTitle>Pending check-ins</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {pendingCheckIns.length === 0 && <p className="text-sm text-muted-foreground">None.</p>}
              {pendingCheckIns.map((t) => (
                <div key={t.id} className="flex items-center justify-between text-sm border-b border-border pb-2 last:border-0">
                  <div><p>Trip {String(t.id).slice(0, 8)}…</p><p className="text-xs text-muted-foreground">{new Date(t.start_at).toLocaleString()}</p></div>
                  <Badge variant="outline" className="capitalize">{t.status.replace(/_/g, " ")}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="incidents">
          <Card><CardHeader><CardTitle>Open incidents</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {incidents.length === 0 && <p className="text-sm text-muted-foreground">No open incidents.</p>}
              {incidents.map((i) => (
                <div key={i.id} className="flex items-center justify-between text-sm border-b border-border pb-2 last:border-0">
                  <div><p className="capitalize">{i.type.replace(/_/g, " ")}</p><p className="text-xs text-muted-foreground">Trip {String(i.trip_id).slice(0, 8)} · {new Date(i.created_at).toLocaleString()}</p></div>
                  <Badge variant="outline">{i.status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent><div className="text-2xl font-bold">{value}</div></CardContent>
    </Card>
  );
}
