import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useCarListing } from "@/hooks/use-car-listing";
import { useTripQuote } from "@/hooks/use-trip-quote";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CarImageCarousel } from "@/components/listing/CarImageCarousel";
import { CarHeaderSummary } from "@/components/listing/CarHeaderSummary";
import { CancellationPolicyCard } from "@/components/listing/CancellationPolicyCard";
import { PaymentOptionsCard } from "@/components/listing/PaymentOptionsCard";
import { KilometersIncludedCard } from "@/components/listing/KilometersIncludedCard";
import { IncludedInPriceCard } from "@/components/listing/IncludedInPriceCard";
import { RatingsSection } from "@/components/listing/RatingsSection";
import { RulesOfRoadSection } from "@/components/listing/RulesOfRoadSection";
import { VehicleFeaturesSection } from "@/components/listing/VehicleFeaturesSection";
import { HostCardSection } from "@/components/listing/HostCardSection";
import { ExtrasSection } from "@/components/listing/ExtrasSection";
import { ProtectionPlanSelector } from "@/components/listing/ProtectionPlanSelector";
import { StickyCheckoutBar } from "@/components/listing/StickyCheckoutBar";
import { DisabledVehicleBanner } from "@/components/listing/DisabledVehicleBanner";
import { ArrowLeft, Share2, Heart, CalendarDays } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export default function CarListing() {
  const { carId } = useParams<{ carId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: car, isLoading, error } = useCarListing(carId);

  // Trip dates: prefer ?start=&end= from search, otherwise default to next week
  const [startDate, setStartDate] = useState<Date>(() => {
    const s = searchParams.get("start");
    return s ? new Date(s) : addDays(new Date(), 7);
  });
  const [endDate, setEndDate] = useState<Date>(() => {
    const e = searchParams.get("end");
    return e ? new Date(e) : addDays(new Date(), 10);
  });
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);

  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [selectedExtras] = useState<string[]>([]);
  const [reserving, setReserving] = useState(false);

  // Default protection plan = Silver (standard tier)
  const { data: defaultSilver } = useQuery({
    queryKey: ["default-silver-plan"],
    queryFn: async () => {
      const { data } = await supabase
        .from("protection_plans")
        .select("id")
        .eq("tier", "standard")
        .eq("is_active", true)
        .maybeSingle();
      return data?.id ?? null;
    },
  });
  useEffect(() => {
    if (!selectedPlanId && defaultSilver) setSelectedPlanId(defaultSilver);
  }, [defaultSilver, selectedPlanId]);

  const tripDays = Math.max(
    1,
    Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
  );

  const quoteParams = useMemo(() => {
    if (!carId) return null;
    return {
      carId,
      startAt: startDate.toISOString(),
      endAt: endDate.toISOString(),
      selectedExtras,
      protectionPlanId: selectedPlanId,
    };
  }, [carId, startDate, endDate, selectedExtras, selectedPlanId]);

  const { data: quote, isLoading: quoteLoading, error: quoteError } = useTripQuote(quoteParams);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Skeleton className="w-full aspect-[4/3]" />
        <div className="p-4 space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  if (error || !car) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">Vehicle not found</h2>
          <p className="text-muted-foreground mb-4">This listing may have been removed.</p>
          <Button onClick={() => navigate("/explore")}>Browse cars</Button>
        </div>
      </div>
    );
  }

  const isDisabled = car.status !== "active";
  const datesUnavailable = !!(quoteError as Error | undefined)?.message?.toLowerCase()?.includes("not available");

  const baseTotalCents = quote?.base_price ?? car.base_daily_price_cents * tripDays;
  const discountCents = quote?.discounts ?? 0;
  const protectionCents = quote?.protection_total ?? 0;
  const totalBeforeTax = quote?.total_before_tax ?? (baseTotalCents - discountCents + protectionCents);
  const includedKmTotal = quote?.included_km_total ?? car.included_km_per_day * tripDays;

  const handleReserve = async () => {
    if (!user) {
      toast({ title: "Please sign in to continue", description: "You need an account to reserve a vehicle." });
      navigate(`/login?redirect=/cars/${carId}`);
      return;
    }
    if (!quote) return;
    setReserving(true);

    // Final availability overlap check before insert
    const { data: overlap } = await supabase
      .from("availability_blocks")
      .select("id")
      .eq("car_id", carId!)
      .lt("start_at", endDate.toISOString())
      .gt("end_at", startDate.toISOString())
      .limit(1);
    if (overlap && overlap.length > 0) {
      setReserving(false);
      toast({
        title: "Dates no longer available",
        description: "Please pick different dates.",
        variant: "destructive",
      });
      return;
    }

    const { data, error: insertErr } = await supabase
      .from("trips")
      .insert({
        car_id: carId!,
        guest_id: user.id,
        start_at: startDate.toISOString(),
        end_at: endDate.toISOString(),
        status: "draft",
        currency: quote.currency,
        total_cents: quote.total_after_tax,
        pickup_location: car.location_label,
        return_location: car.location_label,
        pricing_breakdown: quote as any,
      })
      .select("id")
      .single();
    setReserving(false);
    if (insertErr) {
      toast({ title: "Could not create booking", description: insertErr.message, variant: "destructive" });
      return;
    }
    toast({ title: "Reviewing your booking", description: "Almost done — confirm and pay." });
    navigate(`/checkout/${data.id}`);
  };

  return (
    <div className="min-h-screen bg-background pb-24 relative">
      <Helmet>
        <title>{`${car.year ?? ""} ${car.make ?? ""} ${car.model ?? ""}`.trim() + " — Rent on Rentauto.ca"}</title>
        <meta name="description" content={`Rent the ${car.year ?? ""} ${car.make ?? ""} ${car.model ?? ""} in ${car.location_label ?? "Canada"} from $${Math.round((car.base_daily_price_cents ?? 0) / 100)}/day on Rentauto.ca.`.replace(/\s+/g, " ").trim()} />
      </Helmet>
      {/* Top navigation overlay */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Go back"
          className="rounded-full bg-background/60 backdrop-blur-sm"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" aria-label="Share this car" className="rounded-full bg-background/60 backdrop-blur-sm">
            <Share2 className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Save to favorites" className="rounded-full bg-background/60 backdrop-blur-sm">
            <Heart className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <CarImageCarousel photos={car.photos} />
      <CarHeaderSummary car={car} />

      <div className="h-1 bg-primary" />

      {/* Editable trip dates */}
      <div className="px-4 py-5">
        <h2 className="text-xl font-bold mb-3">Your trip</h2>
        <div className="flex gap-2">
          <Popover open={startOpen} onOpenChange={setStartOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="flex-1 justify-start text-left h-12 rounded-xl">
                <CalendarDays className="h-4 w-4 mr-2" />
                <span className="truncate">{format(startDate, "EEE, MMM d")}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={(d) => { if (d) { setStartDate(d); if (d >= endDate) setEndDate(addDays(d, 3)); } setStartOpen(false); }}
                disabled={(d) => d < new Date()}
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          <Popover open={endOpen} onOpenChange={setEndOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="flex-1 justify-start text-left h-12 rounded-xl">
                <CalendarDays className="h-4 w-4 mr-2" />
                <span className="truncate">{format(endDate, "EEE, MMM d")}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={(d) => { if (d) setEndDate(d); setEndOpen(false); }}
                disabled={(d) => d <= startDate}
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Pickup: <span className="text-foreground">{car.location_label || "TBD"}</span>
        </p>
        {datesUnavailable && (
          <p className="text-sm text-destructive mt-2">These dates aren't available — please pick another range.</p>
        )}
      </div>

      {isDisabled && <DisabledVehicleBanner />}

      <div className="h-1 bg-primary" />
      <CancellationPolicyCard policy={quote?.cancellation_policy_snapshot ?? car.cancellation_policy} />

      <div className="h-1 bg-primary" />
      <PaymentOptionsCard />

      <div className="h-1 bg-primary" />
      <KilometersIncludedCard
        includedKm={includedKmTotal}
        extraKmPriceCents={quote?.extra_km_price ?? car.extra_km_price_cents}
      />

      <div className="h-1 bg-primary" />
      <IncludedInPriceCard />

      <div className="h-1 bg-primary" />
      <ProtectionPlanSelector
        selectedPlanId={selectedPlanId}
        onSelect={setSelectedPlanId}
        days={tripDays}
      />

      <div className="bg-secondary/50">
        <RatingsSection
          ratingAvg={car.rating_avg}
          ratingCount={car.rating_count}
          subRatings={car.sub_ratings}
          reviews={car.reviews}
        />
      </div>

      <div className="h-1 bg-primary" />
      <VehicleFeaturesSection car={car} />

      <div className="h-1 bg-primary" />
      <RulesOfRoadSection rules={car.rules} />

      <div className="bg-secondary/50">
        <HostCardSection host={car.host} />
      </div>

      <div className="h-1 bg-primary" />
      <ExtrasSection extras={car.extras} />

      {quote && (
        <div className="px-4 py-4 space-y-2 text-sm border-t border-border">
          <h3 className="font-bold text-base">Price breakdown</h3>
          <div className="flex justify-between">
            <span className="text-muted-foreground">${(car.base_daily_price_cents / 100).toFixed(0)}/day × {quote.days} days</span>
            <span>${(quote.base_price / 100).toFixed(2)}</span>
          </div>
          {quote.discounts > 0 && (
            <div className="flex justify-between text-success">
              <span>Multi-day discount ({quote.discount_percent}%)</span>
              <span>-${(quote.discounts / 100).toFixed(2)}</span>
            </div>
          )}
          {quote.protection_total > 0 && quote.protection_snapshot && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">{quote.protection_snapshot.name} protection × {quote.days} days</span>
              <span>${(quote.protection_total / 100).toFixed(2)}</span>
            </div>
          )}
          {quote.extras_breakdown.map((ex) => (
            <div key={ex.name} className="flex justify-between">
              <span className="text-muted-foreground">{ex.name}</span>
              <span>${(ex.price_cents / 100).toFixed(2)}</span>
            </div>
          ))}
          <div className="flex justify-between border-t border-border pt-2">
            <span className="text-muted-foreground">Subtotal</span>
            <span>${(quote.total_before_tax / 100).toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Taxes (est.)</span>
            <span>${(quote.taxes / 100).toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold text-base pt-1 border-t border-border">
            <span>Total</span>
            <span>${(quote.total_after_tax / 100).toFixed(2)} CAD</span>
          </div>
        </div>
      )}

      <StickyCheckoutBar
        originalCents={baseTotalCents}
        totalCents={totalBeforeTax}
        disabled={isDisabled || datesUnavailable || !quote}
        loading={quoteLoading || reserving}
        ctaLabel={user ? "Reserve" : "Sign in to reserve"}
        onReserve={handleReserve}
      />
    </div>
  );
}
