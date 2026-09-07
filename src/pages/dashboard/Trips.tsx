import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { CalendarDays, MapPin, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { TripListSkeleton } from "@/components/ui/skeletons";
import { DashboardPageHeader, StatusBadge } from "@/components/dashboard/DashboardPageHeader";
import { TRIP_STATUS, PAYMENT_STATUS, tripAction, money, bookingRef } from "@/lib/dashboard-utils";

interface Row {
  id: string;
  car_id: string;
  start_at: string;
  end_at: string;
  status: string;
  payment_status: string | null;
  total_cents: number | null;
  pickup_location: string | null;
  created_at: string;
  booking_reference: string | null;
}

type Bucket = "upcoming" | "active" | "past" | "cancelled" | "drafts";

function bucketOf(t: Row): Bucket {
  const now = Date.now();
  if (t.status === "cancelled") return "cancelled";
  if (t.status === "draft" || t.status === "quote" || t.status === "pending_payment") return "drafts";
  if (t.status === "completed" || new Date(t.end_at).getTime() < now) return "past";
  if (new Date(t.start_at).getTime() <= now && new Date(t.end_at).getTime() >= now) return "active";
  return "upcoming";
}

export default function DashboardTrips() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [cars, setCars] = useState<Record<string, any>>({});
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("trips")
        .select("id, car_id, start_at, end_at, status, payment_status, total_cents, pickup_location, created_at, booking_reference")
        .eq("guest_id", user.id)
        .order("start_at", { ascending: false });
      if (cancelled) return;
      const list = (data ?? []) as Row[];
      setRows(list);
      const ids = [...new Set(list.map((t) => t.car_id))];
      if (ids.length) {
        const [c, p] = await Promise.all([
          supabase.from("cars").select("id, make, model, year, location_label").in("id", ids),
          supabase.from("car_photos").select("car_id, url").in("car_id", ids).order("sort_order"),
        ]);
        if (cancelled) return;
        const cm: Record<string, any> = {};
        (c.data ?? []).forEach((x: any) => (cm[x.id] = x));
        setCars(cm);
        const pm: Record<string, string> = {};
        (p.data ?? []).forEach((x: any) => {
          if (!pm[x.car_id]) pm[x.car_id] = x.url;
        });
        setPhotos(pm);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((t) => {
      const c = cars[t.car_id];
      const label = c ? `${c.year} ${c.make} ${c.model}` : "";
      return (
        label.toLowerCase().includes(needle) ||
        bookingRef(t.id, t.created_at, t.booking_reference).toLowerCase().includes(needle) ||
        (t.pickup_location ?? "").toLowerCase().includes(needle)
      );
    });
  }, [rows, cars, q]);

  const buckets = useMemo(() => {
    const b: Record<Bucket, Row[]> = { upcoming: [], active: [], past: [], cancelled: [], drafts: [] };
    filtered.forEach((t) => b[bucketOf(t)].push(t));
    return b;
  }, [filtered]);

  const renderList = (list: Row[], emptyTitle: string, emptyDesc: string) => {
    if (list.length === 0) {
      return (
        <EmptyState
          icon={CalendarDays}
          title={emptyTitle}
          description={emptyDesc}
          action={{ label: "Browse vehicles", href: "/explore" }}
        />
      );
    }
    return (
      <ul className="space-y-3">
        {list.map((t) => {
          const c = cars[t.car_id];
          const action = tripAction(t.status, t.id);
          return (
            <li key={t.id}>
              <Card>
                <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                  <div className="h-32 w-full shrink-0 overflow-hidden rounded-lg bg-muted sm:h-20 sm:w-32">
                    {photos[t.car_id] && (
                      <img
                        src={photos[t.car_id]}
                        alt={c ? `${c.year} ${c.make} ${c.model}` : "Vehicle"}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{c ? `${c.year} ${c.make} ${c.model}` : "Vehicle"}</span>
                      <StatusBadge tone={TRIP_STATUS[t.status]?.tone ?? "neutral"}>
                        {TRIP_STATUS[t.status]?.label ?? t.status}
                      </StatusBadge>
                      {t.payment_status && (
                        <StatusBadge tone={PAYMENT_STATUS[t.payment_status]?.tone ?? "neutral"}>
                          {PAYMENT_STATUS[t.payment_status]?.label ?? t.payment_status}
                        </StatusBadge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(t.start_at), "MMM d, HH:mm")} → {format(new Date(t.end_at), "MMM d, HH:mm")}
                    </p>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="font-mono">Booking {bookingRef(t.id, t.created_at, t.booking_reference)}</span>
                      {(t.pickup_location || c?.location_label) && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {t.pickup_location || c?.location_label}
                        </span>
                      )}
                      <span className="font-medium text-foreground">{money(t.total_cents)}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/trips/${t.id}`}>Details</Link>
                    </Button>
                    <Button asChild size="sm">
                      <Link to={action.to}>{action.label}</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div className="space-y-6">
      <DashboardPageHeader title="My trips" description="Every booking you've made, grouped by status." />

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by vehicle, city or booking ref"
          aria-label="Search trips"
          className="pl-9"
        />
      </div>

      {loading ? (
        <TripListSkeleton />
      ) : (
        <Tabs defaultValue="upcoming">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="upcoming">Upcoming ({buckets.upcoming.length})</TabsTrigger>
            <TabsTrigger value="active">Active ({buckets.active.length})</TabsTrigger>
            <TabsTrigger value="past">Past ({buckets.past.length})</TabsTrigger>
            <TabsTrigger value="drafts">Drafts ({buckets.drafts.length})</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled ({buckets.cancelled.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="upcoming" className="mt-4">
            {renderList(buckets.upcoming, "No upcoming trips", "Book a vehicle to see it here.")}
          </TabsContent>
          <TabsContent value="active" className="mt-4">
            {renderList(buckets.active, "No active trip", "Your trip appears here once it starts.")}
          </TabsContent>
          <TabsContent value="past" className="mt-4">
            {renderList(buckets.past, "No past trips", "Completed rentals will be listed here.")}
          </TabsContent>
          <TabsContent value="drafts" className="mt-4">
            {renderList(buckets.drafts, "No drafts", "Unfinished bookings are saved here so you can resume them.")}
          </TabsContent>
          <TabsContent value="cancelled" className="mt-4">
            {renderList(buckets.cancelled, "No cancellations", "Cancelled bookings appear here with refund status.")}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
