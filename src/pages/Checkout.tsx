import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Checkbox } from "@/components/ui/checkbox";
import { SafeImage } from "@/components/ui/safe-image";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Calendar, MapPin, Shield, AlertTriangle, Loader2, Lock } from "lucide-react";
import { format } from "date-fns";

export default function Checkout() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [trip, setTrip] = useState<any>(null);
  const [car, setCar] = useState<any>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [host, setHost] = useState<any>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [paying, setPaying] = useState(false);
  const [paymentNotConfigured, setPaymentNotConfigured] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate(`/login?redirect=/checkout/${tripId}`);
      return;
    }
    if (!tripId) return;

    (async () => {
      setLoading(true);
      const { data: t, error: tErr } = await supabase
        .from("trips").select("*").eq("id", tripId).maybeSingle();
      if (tErr || !t) { setError("Trip not found"); setLoading(false); return; }
      if (t.guest_id !== user.id) { setError("You don't have access to this booking."); setLoading(false); return; }
      if (!["draft", "pending_payment"].includes(t.status)) {
        navigate(`/trips/${t.id}`, { replace: true }); return;
      }
      setTrip(t);

      const [{ data: c }, { data: p }, { data: blocks }] = await Promise.all([
        supabase.from("cars").select("id, make, model, year, title, location_label, host_id").eq("id", t.car_id).maybeSingle(),
        supabase.from("car_photos").select("url").eq("car_id", t.car_id).order("sort_order").limit(1).maybeSingle(),
        supabase.from("availability_blocks").select("id").eq("car_id", t.car_id).lt("start_at", t.end_at).gt("end_at", t.start_at).limit(1),
      ]);
      setCar(c);
      setPhoto(p?.url ?? null);
      if ((blocks || []).length > 0) setUnavailable(true);

      if (c?.host_id) {
        const { data: h } = await supabase.from("profiles_public" as any)
          .select("display_name, first_name, avatar_url, rating_avg")
          .eq("id", c.host_id).maybeSingle();
        setHost(h as any);
      }
      setLoading(false);
    })();
  }, [tripId, user, authLoading, navigate]);

  const handlePay = async () => {
    if (!trip) return;
    setPaying(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout-session", {
        body: { tripId: trip.id, returnUrl: `${window.location.origin}/trips/${trip.id}` },
      });
      if (error) {
        const msg = (error as any).message || "Could not start payment";
        if (msg.includes("PAYMENT_NOT_CONFIGURED") || msg.toLowerCase().includes("not configured")) {
          setPaymentNotConfigured(true);
        } else if (msg.toLowerCase().includes("no longer available")) {
          setUnavailable(true);
        } else {
          toast({ title: "Payment failed to start", description: msg, variant: "destructive" });
        }
        setPaying(false);
        return;
      }
      if (data?.error === "PAYMENT_NOT_CONFIGURED") { setPaymentNotConfigured(true); setPaying(false); return; }
      if (data?.url) { window.location.href = data.url; return; }
      toast({ title: "Payment failed to start", variant: "destructive" });
      setPaying(false);
    } catch (e) {
      toast({ title: "Payment failed to start", description: (e as Error).message, variant: "destructive" });
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="container max-w-2xl py-8 pb-32 space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }
  if (error || !trip) {
    return (
      <div className="container max-w-2xl py-8">
        <ErrorState
          title="Cannot load checkout"
          description={error || "We couldn't find this booking."}
          onRetry={() => navigate("/trips")}
        />
      </div>
    );
  }

  const pricing = trip.pricing_breakdown || {};
  const protection = pricing.protection_snapshot;
  const totalCents = trip.total_cents || pricing.total_after_tax || 0;

  return (
    <div className="container max-w-2xl py-6 pb-32 space-y-4">
      <Link to={`/cars/${trip.car_id}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <h1 className="text-2xl font-bold">Review and pay</h1>

      <Card>
        <CardContent className="p-4 flex gap-4">
          <SafeImage src={photo ?? undefined} className="w-28 h-28 rounded-lg shrink-0" alt={car ? `${car.make} ${car.model}` : "Vehicle"} />
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold truncate">{car ? `${car.year} ${car.make} ${car.model}` : "Vehicle"}</h2>
            {host && (
              <p className="text-sm text-muted-foreground">Hosted by {host.display_name || host.first_name || "Rentauto host"}</p>
            )}
            {car?.location_label && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><MapPin className="h-3 w-3" /> {car.location_label}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Calendar className="h-4 w-4" /> Trip dates</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-1">
          <div>{format(new Date(trip.start_at), "EEE MMM d, yyyy h:mma")}</div>
          <div>→ {format(new Date(trip.end_at), "EEE MMM d, yyyy h:mma")}</div>
          {trip.pickup_location && <p className="text-muted-foreground pt-2">Pickup: {trip.pickup_location}</p>}
          {trip.return_location && <p className="text-muted-foreground">Return: {trip.return_location}</p>}
        </CardContent>
      </Card>

      {protection && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4" /> Protection: {protection.name}</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            ${(protection.price_per_day_cents / 100).toFixed(2)}/day · Deductible ${((protection.deductible_cents || 0) / 100).toFixed(0)}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Price breakdown</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          {pricing.days != null && (
            <Row label={`${pricing.days} day${pricing.days === 1 ? "" : "s"} × $${((pricing.base_price || 0) / Math.max(pricing.days || 1, 1) / 100).toFixed(0)}`}
                 value={`$${((pricing.base_price || 0) / 100).toFixed(2)}`} />
          )}
          {pricing.discounts > 0 && <Row label={`Multi-day discount (${pricing.discount_percent}%)`} value={`-$${(pricing.discounts / 100).toFixed(2)}`} />}
          {pricing.protection_total > 0 && <Row label="Protection" value={`$${(pricing.protection_total / 100).toFixed(2)}`} />}
          {pricing.taxes != null && <Row label="Taxes (GST + QST)" value={`$${(pricing.taxes / 100).toFixed(2)}`} />}
          <div className="border-t border-border my-2" />
          <Row bold label="Total due" value={`$${(totalCents / 100).toFixed(2)} ${trip.currency || "CAD"}`} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Rental rules</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>By continuing you agree to Rentauto's <Link to="/terms" className="underline">Terms</Link>, <Link to="/cancellation-policy" className="underline">Cancellation Policy</Link>, and <Link to="/insurance" className="underline">Insurance & Protection</Link> terms.</p>
          <label className="flex items-start gap-2 text-foreground cursor-pointer">
            <Checkbox checked={acknowledged} onCheckedChange={(v) => setAcknowledged(!!v)} />
            <span>I acknowledge the cancellation policy, mileage limits, and rental rules for this trip.</span>
          </label>
        </CardContent>
      </Card>

      {unavailable && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-4 flex gap-3 items-start">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-destructive">Dates no longer available</p>
              <p className="text-muted-foreground">Another booking has taken these dates. Please pick a new range.</p>
              <Button variant="outline" size="sm" className="mt-2" asChild>
                <Link to={`/cars/${trip.car_id}`}>Pick new dates</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {paymentNotConfigured && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="p-4 text-sm">
            <p className="font-medium">Payment setup incomplete</p>
            <p className="text-muted-foreground">Live payments are not yet enabled on this environment. Your booking has been saved as a draft and you can complete it once payments are configured.</p>
          </CardContent>
        </Card>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur border-t border-border px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Total due</p>
          <p className="text-lg font-bold truncate">${(totalCents / 100).toFixed(2)} {trip.currency || "CAD"}</p>
        </div>
        <Button size="lg" className="px-6 rounded-xl shrink-0" disabled={!acknowledged || unavailable || paying || paymentNotConfigured} onClick={handlePay}>
          {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
          {paying ? "Starting…" : "Confirm and pay"}
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${bold ? "font-semibold text-base pt-1" : ""}`}>
      <span className={bold ? "" : "text-muted-foreground"}>{label}</span>
      <span>{value}</span>
    </div>
  );
}
