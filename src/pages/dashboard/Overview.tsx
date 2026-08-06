import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNowStrict, format } from "date-fns";
import {
  Car,
  CalendarDays,
  Heart,
  MessageSquare,
  IdCard,
  CreditCard,
  LifeBuoy,
  MapPin,
  Shield,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { DashboardSkeleton } from "@/components/ui/skeletons";
import { StatusBadge } from "@/components/dashboard/DashboardPageHeader";
import { TRIP_STATUS, tripAction, money, bookingRef } from "@/lib/dashboard-utils";

interface TripRow {
  id: string;
  car_id: string;
  start_at: string;
  end_at: string;
  status: string;
  payment_status: string | null;
  total_cents: number | null;
  pickup_location: string | null;
  pricing_breakdown: any;
  created_at: string;
}

interface CarRow {
  id: string;
  make: string;
  model: string;
  year: number;
  title: string | null;
  location_label: string | null;
  base_daily_price_cents: number;
}

const QUICK_ACTIONS = [
  { label: "Browse vehicles", to: "/explore", icon: Car },
  { label: "My trips", to: "/dashboard/trips", icon: CalendarDays },
  { label: "Favorites", to: "/dashboard/favorites", icon: Heart },
  { label: "Messages", to: "/dashboard/messages", icon: MessageSquare },
  { label: "Identity verification", to: "/dashboard/documents", icon: IdCard },
  { label: "Payments", to: "/dashboard/payments", icon: CreditCard },
  { label: "Contact support", to: "/dashboard/support", icon: LifeBuoy },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function DashboardOverview() {
  const { user, displayName } = useAuth();
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [cars, setCars] = useState<Record<string, CarRow>>({});
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [profile, setProfile] = useState<any>(null);
  const [verification, setVerification] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [recommended, setRecommended] = useState<CarRow[]>([]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      const [tripsRes, profileRes, verRes, ticketsRes, incRes] = await Promise.all([
        supabase
          .from("trips")
          .select(
            "id, car_id, start_at, end_at, status, payment_status, total_cents, pickup_location, pricing_breakdown, created_at",
          )
          .eq("guest_id", user.id)
          .order("start_at", { ascending: true }),
        supabase
          .from("profiles")
          .select("first_name, last_name, phone, phone_verified, id_verified, avatar_url, city, province, postal_code, display_name")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("host_verifications")
          .select("verification_status, id_front_url, id_back_url, selfie_url")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("support_tickets")
          .select("id, subject, status, priority, last_response_at, created_at")
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("trip_incidents")
          .select("id, type, status, created_at, trip_id")
          .eq("reporter_user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      if (cancelled) return;

      const tripList = (tripsRes.data ?? []) as TripRow[];
      setTrips(tripList);
      setProfile(profileRes.data ?? null);
      setVerification(verRes.data ?? null);
      setTickets(ticketsRes.data ?? []);
      setIncidents(incRes.data ?? []);

      const carIds = [...new Set(tripList.map((t) => t.car_id))];
      if (carIds.length) {
        const [carsRes, photoRes, eventsRes] = await Promise.all([
          supabase
            .from("cars")
            .select("id, make, model, year, title, location_label, base_daily_price_cents")
            .in("id", carIds),
          supabase.from("car_photos").select("car_id, url").in("car_id", carIds).order("sort_order"),
          supabase
            .from("trip_events")
            .select("id, trip_id, event_type, created_at")
            .in("trip_id", tripList.map((t) => t.id))
            .order("created_at", { ascending: false })
            .limit(8),
        ]);
        if (cancelled) return;
        const cm: Record<string, CarRow> = {};
        (carsRes.data ?? []).forEach((c: any) => (cm[c.id] = c));
        setCars(cm);
        const pm: Record<string, string> = {};
        (photoRes.data ?? []).forEach((p: any) => {
          if (!pm[p.car_id]) pm[p.car_id] = p.url;
        });
        setPhotos(pm);
        setEvents(eventsRes.data ?? []);
      }

      const prefCity = profileRes.data?.city ?? null;
      let recQuery = supabase
        .from("cars")
        .select("id, make, model, year, title, location_label, base_daily_price_cents")
        .eq("status", "active")
        .limit(6);
      if (prefCity) recQuery = recQuery.ilike("location_label", `%${prefCity}%`);
      let { data: recs } = await recQuery;
      if (!recs || recs.length === 0) {
        const fallback = await supabase
          .from("cars")
          .select("id, make, model, year, title, location_label, base_daily_price_cents")
          .eq("status", "active")
          .limit(6);
        recs = fallback.data ?? [];
      }
      if (!cancelled) {
        setRecommended(recs as CarRow[]);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const nextTrip = useMemo(() => {
    const now = Date.now();
    const active = trips.find(
      (t) =>
        !["cancelled", "completed"].includes(t.status) &&
        new Date(t.start_at).getTime() <= now &&
        new Date(t.end_at).getTime() >= now,
    );
    if (active) return active;
    return (
      trips.find((t) => !["cancelled", "completed"].includes(t.status) && new Date(t.start_at).getTime() > now) ?? null
    );
  }, [trips]);

  const readiness = useMemo(() => {
    const docsSubmitted = Boolean(verification?.id_front_url && verification?.id_back_url);
    const items = [
      { label: "Email verified", done: Boolean(user?.email_confirmed_at), to: "/verify-email" },
      { label: "Full name completed", done: Boolean(profile?.first_name && profile?.last_name), to: "/dashboard/profile" },
      { label: "Phone number verified", done: Boolean(profile?.phone_verified), to: "/dashboard/profile" },
      { label: "Profile photo uploaded", done: Boolean(profile?.avatar_url), to: "/dashboard/profile" },
      {
        label: "Driver's licence verification",
        done: verification?.verification_status === "verified" || verification?.verification_status === "approved",
        to: "/dashboard/documents",
        hint: docsSubmitted ? "Submitted — under review" : undefined,
      },
      { label: "Address completed", done: Boolean(profile?.city && profile?.province && profile?.postal_code), to: "/dashboard/profile" },
      { label: "Payment method", done: trips.some((t) => t.payment_status === "paid"), to: "/dashboard/payments" },
      { label: "Terms accepted", done: true, to: "/terms" },
    ];
    const pct = Math.round((items.filter((i) => i.done).length / items.length) * 100);
    return { items, pct };
  }, [profile, verification, user, trips]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  const name = displayName || profile?.first_name || user?.email?.split("@")[0] || "there";
  const initials = (name as string).slice(0, 2).toUpperCase();
  const nextCar = nextTrip ? cars[nextTrip.car_id] : null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <section className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card p-5">
        <Avatar className="h-14 w-14">
          {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt="" />}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold md:text-2xl">
            {greeting()}, {name}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {nextTrip
              ? `Your next trip starts ${formatDistanceToNowStrict(new Date(nextTrip.start_at), { addSuffix: true })}`
              : "No upcoming trips — browse vehicles to plan your next one."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {readiness.pct < 100 ? (
            <StatusBadge tone="warning">
              <AlertTriangle className="h-3 w-3" /> Profile {readiness.pct}% complete
            </StatusBadge>
          ) : (
            <StatusBadge tone="success">
              <CheckCircle2 className="h-3 w-3" /> Account verified
            </StatusBadge>
          )}
          <Button asChild variant="outline" size="sm">
            <Link to="/dashboard/profile">Account</Link>
          </Button>
        </div>
      </section>

      {/* Next trip */}
      <section aria-labelledby="next-trip-h">
        <h2 id="next-trip-h" className="mb-3 text-lg font-semibold">
          Next trip
        </h2>
        {nextTrip ? (
          <Card>
            <CardContent className="flex flex-col gap-4 p-4 sm:flex-row">
              <div className="h-40 w-full shrink-0 overflow-hidden rounded-lg bg-muted sm:h-28 sm:w-44">
                {photos[nextTrip.car_id] && (
                  <img
                    src={photos[nextTrip.car_id]}
                    alt={nextCar ? `${nextCar.year} ${nextCar.make} ${nextCar.model}` : "Vehicle"}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">
                    {nextCar ? `${nextCar.year} ${nextCar.make} ${nextCar.model}` : "Vehicle"}
                  </h3>
                  <StatusBadge tone={TRIP_STATUS[nextTrip.status]?.tone ?? "neutral"}>
                    {TRIP_STATUS[nextTrip.status]?.label ?? nextTrip.status}
                  </StatusBadge>
                  <span className="text-xs text-muted-foreground">
                    {bookingRef(nextTrip.id, nextTrip.created_at)}
                  </span>
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Pickup</dt>
                    <dd>{format(new Date(nextTrip.start_at), "EEE MMM d, HH:mm")}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Return</dt>
                    <dd>{format(new Date(nextTrip.end_at), "EEE MMM d, HH:mm")}</dd>
                  </div>
                </dl>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  {(nextTrip.pickup_location || nextCar?.location_label) && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {nextTrip.pickup_location || nextCar?.location_label}
                    </span>
                  )}
                  {nextTrip.pricing_breakdown?.protection_snapshot?.name && (
                    <span className="flex items-center gap-1">
                      <Shield className="h-3 w-3" /> {nextTrip.pricing_breakdown.protection_snapshot.name}
                    </span>
                  )}
                  <span className="font-medium text-foreground">{money(nextTrip.total_cents)}</span>
                </div>
              </div>
              <div className="flex shrink-0 items-end">
                <Button asChild className="w-full sm:w-auto">
                  <Link to={tripAction(nextTrip.status, nextTrip.id).to}>
                    {tripAction(nextTrip.status, nextTrip.id).label}
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <EmptyState
            icon={CalendarDays}
            title="No upcoming trip"
            description="Find a vehicle near you and book your next rental in a few minutes."
            action={{ label: "Browse vehicles", href: "/explore" }}
          />
        )}
      </section>

      {/* Quick actions */}
      <section aria-labelledby="quick-h">
        <h2 id="quick-h" className="mb-3 text-lg font-semibold">
          Quick actions
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {QUICK_ACTIONS.map((a) => (
            <Link
              key={a.to}
              to={a.to}
              className="flex min-h-11 items-center gap-3 rounded-lg border border-border bg-card p-3 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-muted/50"
            >
              <a.icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <span className="min-w-0 truncate">{a.label}</span>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Account readiness */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Account readiness</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <Progress value={readiness.pct} className="h-2" aria-label={`Account ${readiness.pct}% complete`} />
              <span className="text-sm font-semibold tabular-nums">{readiness.pct}%</span>
            </div>
            <ul className="divide-y divide-border">
              {readiness.items.map((item) => (
                <li key={item.label} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    {item.done ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
                    )}
                    <span className="truncate">{item.label}</span>
                    <span className="sr-only">{item.done ? "complete" : "incomplete"}</span>
                  </span>
                  {item.done ? (
                    <span className="text-xs text-muted-foreground">{(item as any).hint ?? "Done"}</span>
                  ) : (
                    <Link to={item.to} className="text-xs font-medium text-primary hover:underline">
                      {(item as any).hint ?? "Complete"}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Activity from your bookings will appear here.
              </p>
            ) : (
              <ol className="space-y-3">
                {events.map((e) => (
                  <li key={e.id} className="flex items-start gap-3 text-sm">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <Link to={`/trips/${e.trip_id}`} className="font-medium capitalize hover:underline">
                        {String(e.event_type).replace(/_/g, " ")}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(e.created_at), "MMM d, yyyy • HH:mm")}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Support status */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base">Support</CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link to="/dashboard/support">
              Support centre <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Open tickets</p>
            {tickets.filter((t) => t.status !== "resolved" && t.status !== "closed").length === 0 ? (
              <p className="mt-1 text-sm text-muted-foreground">No open tickets.</p>
            ) : (
              <ul className="mt-1 space-y-1 text-sm">
                {tickets
                  .filter((t) => t.status !== "resolved" && t.status !== "closed")
                  .map((t) => (
                    <li key={t.id} className="truncate">
                      {t.subject}
                    </li>
                  ))}
              </ul>
            )}
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Incident reports</p>
            {incidents.length === 0 ? (
              <p className="mt-1 text-sm text-muted-foreground">No incidents reported.</p>
            ) : (
              <ul className="mt-1 space-y-1 text-sm">
                {incidents.map((i) => (
                  <li key={i.id} className="truncate capitalize">
                    <Link to={`/trips/${i.trip_id}`} className="hover:underline">
                      {String(i.type).replace(/_/g, " ")} — {i.status}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recommended */}
      {recommended.length > 0 && (
        <section aria-labelledby="rec-h">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="rec-h" className="text-lg font-semibold">
              Recommended for you
            </h2>
            <Button asChild variant="ghost" size="sm">
              <Link to="/explore">
                See all <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recommended.map((c) => (
              <Link
                key={c.id}
                to={`/cars/${c.id}`}
                className="rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/50"
              >
                <p className="truncate font-medium">{`${c.year} ${c.make} ${c.model}`}</p>
                <p className="truncate text-xs text-muted-foreground">{c.location_label ?? "Quebec"}</p>
                <p className="mt-1 text-sm font-semibold">
                  ${(c.base_daily_price_cents / 100).toFixed(0)}
                  <span className="text-xs font-normal text-muted-foreground"> /day</span>
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
