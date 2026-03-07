import { useParams, useNavigate } from "react-router-dom";
import { useCarListing } from "@/hooks/use-car-listing";
import { useTripQuote } from "@/hooks/use-trip-quote";
import { Skeleton } from "@/components/ui/skeleton";
import { CarImageCarousel } from "@/components/listing/CarImageCarousel";
import { CarHeaderSummary } from "@/components/listing/CarHeaderSummary";
import { TripSection } from "@/components/listing/TripSection";
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
import { ArrowLeft, Share2, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useMemo } from "react";
import { addDays } from "date-fns";

export default function CarListing() {
  const { carId } = useParams<{ carId: string }>();
  const navigate = useNavigate();
  const { data: car, isLoading, error } = useCarListing(carId);

  // Trip dates state
  const [startDate] = useState(() => addDays(new Date(), 7));
  const [endDate] = useState(() => addDays(new Date(), 10));
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);

  const tripDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));

  // Call quote engine
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

  const { data: quote, isLoading: quoteLoading } = useTripQuote(quoteParams);

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

  // Use quote data if available, otherwise fallback to local calc
  const baseTotalCents = quote?.base_price ?? car.base_daily_price_cents * tripDays;
  const discountCents = quote?.discounts ?? Math.round(baseTotalCents * 0.05);
  const totalBeforeTax = quote?.total_before_tax ?? (baseTotalCents - discountCents);
  const totalAfterTax = quote?.total_after_tax ?? totalBeforeTax;
  const includedKmTotal = quote?.included_km_total ?? car.included_km_per_day * tripDays;

  return (
    <div className="min-h-screen bg-background pb-24 relative">
      {/* Top navigation overlay */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full bg-background/60 backdrop-blur-sm"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" className="rounded-full bg-background/60 backdrop-blur-sm">
            <Share2 className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="rounded-full bg-background/60 backdrop-blur-sm">
            <Heart className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Hero carousel */}
      <CarImageCarousel photos={car.photos} />

      {/* Header */}
      <CarHeaderSummary car={car} />

      <div className="h-1 bg-primary" />

      {/* Your trip */}
      <TripSection location={car.location_label} />

      {/* Disabled banner */}
      {isDisabled && <DisabledVehicleBanner />}

      <div className="h-1 bg-primary" />

      {/* Cancellation */}
      <CancellationPolicyCard policy={quote?.cancellation_policy_snapshot ?? car.cancellation_policy} />

      <div className="h-1 bg-primary" />

      {/* Payment options */}
      <PaymentOptionsCard />

      <div className="h-1 bg-primary" />

      {/* Kilometers included */}
      <KilometersIncludedCard
        includedKm={includedKmTotal}
        extraKmPriceCents={quote?.extra_km_price ?? car.extra_km_price_cents}
      />

      <div className="h-1 bg-primary" />

      {/* Included in the price */}
      <IncludedInPriceCard />

      <div className="h-1 bg-primary" />

      {/* Insurance & Protection */}
      <ProtectionPlanSelector
        selectedPlanId={selectedPlanId}
        onSelect={setSelectedPlanId}
        days={tripDays}
      />

      {/* Ratings and reviews */}
      <div className="bg-secondary/50">
        <RatingsSection
          ratingAvg={car.rating_avg}
          ratingCount={car.rating_count}
          subRatings={car.sub_ratings}
          reviews={car.reviews}
        />
      </div>

      <div className="h-1 bg-primary" />

      {/* Vehicle features */}
      <VehicleFeaturesSection car={car} />

      <div className="h-1 bg-primary" />

      {/* Rules of the road */}
      <RulesOfRoadSection rules={car.rules} />

      {/* Hosted by */}
      <div className="bg-secondary/50">
        <HostCardSection host={car.host} />
      </div>

      <div className="h-1 bg-primary" />

      {/* Extras */}
      <ExtrasSection extras={car.extras} />

      {/* Quote summary */}
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
            <span>${(quote.total_after_tax / 100).toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Sticky checkout bar */}
      <StickyCheckoutBar
        originalCents={baseTotalCents}
        totalCents={totalBeforeTax}
        disabled={isDisabled}
        loading={quoteLoading}
      />
    </div>
  );
}
