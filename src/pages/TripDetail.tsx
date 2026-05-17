import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, MapPin, Calendar, Shield, AlertTriangle, KeyRound, LogOut } from "lucide-react";
import { format } from "date-fns";
import { LiveLocationCard } from "@/components/tracking/LiveLocationCard";

export default function TripDetail() {
  const { tripId } = useParams<{ tripId: string }>();
  const { user, isLoading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [trip, setTrip] = useState<any>(null);
  const [car, setCar] = useState<any>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !tripId) return;
    (async () => {
      setLoading(true);
      const { data: t, error: tErr } = await supabase
        .from("trips")
        .select("*")
        .eq("id", tripId)
        .maybeSingle();
      if (tErr || !t) {
        setError(tErr?.message || "Trip not found");
        setLoading(false);
        return;
      }
      setTrip(t);
      const [{ data: c }, { data: p }] = await Promise.all([
        supabase
          .from("cars")
          .select("id, make, model, year, title, location_label, host_id")
          .eq("id", t.car_id)
          .maybeSingle(),
        supabase
          .from("car_photos")
          .select("url")
          .eq("car_id", t.car_id)
          .order("sort_order"),
      ]);
      setCar(c);
      setPhotos((p || []).map((x: any) => x.url));
      setLoading(false);
    })();
  }, [tripId, authLoading]);

  if (loading) {
    return (
      <div className="container py-8 max-w-3xl mx-auto pb-24 md:pb-8 space-y-3">
        <Skeleton className="h-56 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="container py-8 max-w-3xl mx-auto pb-24 md:pb-8">
        <Card>
          <CardHeader>
            <CardTitle>Trip not found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button asChild variant="outline">
              <Link to="/trips">Back to trips</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const pricing = trip.pricing_breakdown || {};
  const protection = pricing.protection_snapshot;

  return (
    <div className="container py-8 max-w-3xl mx-auto pb-24 md:pb-8 space-y-4">
      <Link
        to="/trips"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to trips
      </Link>

      {photos.length > 0 && (
        <div className="grid grid-cols-2 gap-2 rounded-xl overflow-hidden">
          <img src={photos[0]} alt="" className="aspect-[4/3] object-cover w-full row-span-2" />
          {photos.slice(1, 3).map((p, i) => (
            <img key={i} src={p} alt="" className="aspect-[4/3] object-cover w-full" />
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            {car ? `${car.make} ${car.model} ${car.year}` : "Vehicle"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            {format(new Date(trip.start_at), "MMM d, yyyy h:mma")} →{" "}
            {format(new Date(trip.end_at), "MMM d, yyyy h:mma")}
          </div>
          {trip.pickup_location && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" /> Pickup: {trip.pickup_location}
            </div>
          )}
          {trip.return_location && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" /> Return: {trip.return_location}
            </div>
          )}
          <div className="pt-2">
            <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary capitalize">
              {trip.status.replace("_", " ")}
            </span>
          </div>
        </CardContent>
      </Card>

      {protection && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4" /> Protection: {protection.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            ${(protection.price_per_day_cents / 100).toFixed(2)}/day
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pricing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {pricing.days != null && (
            <Row label={`${pricing.days} day${pricing.days === 1 ? "" : "s"} × $${((pricing.daily_rate_cents || 0) / 100).toFixed(0)}`}
                 value={`$${((pricing.base_total_cents || 0) / 100).toFixed(2)}`} />
          )}
          {pricing.protection_total_cents != null && (
            <Row label="Protection" value={`$${(pricing.protection_total_cents / 100).toFixed(2)}`} />
          )}
          {pricing.taxes_cents != null && (
            <Row label="Taxes (est.)" value={`$${(pricing.taxes_cents / 100).toFixed(2)}`} />
          )}
          <div className="border-t border-border my-2" />
          <Row
            label="Total"
            value={`$${((trip.total_cents || pricing.total_cents || 0) / 100).toFixed(2)} ${trip.currency || "CAD"}`}
            bold
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${bold ? "font-semibold" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
