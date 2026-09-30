import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useCarListing } from "@/hooks/use-car-listing";
import { useTripQuote } from "@/hooks/use-trip-quote";
import { useQuery } from "@tanstack/react-query";
import { DetailPageSkeleton } from "@/components/ui/skeletons";
import { ErrorState } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";
import { PhotoGallery } from "@/components/listing/PhotoGallery";
import { VehicleIdentity } from "@/components/listing/VehicleIdentity";
import { PolicyAccordion } from "@/components/listing/PolicyAccordion";
import { BookingPanel } from "@/components/listing/BookingPanel";
import { RatingsSection } from "@/components/listing/RatingsSection";
import { VehicleFeaturesSection } from "@/components/listing/VehicleFeaturesSection";
import { HostCardSection } from "@/components/listing/HostCardSection";
import { ExtrasSection } from "@/components/listing/ExtrasSection";
import { ProtectionPlanSelector } from "@/components/listing/ProtectionPlanSelector";
import { StickyCheckoutBar } from "@/components/listing/StickyCheckoutBar";
import { DisabledVehicleBanner } from "@/components/listing/DisabledVehicleBanner";
import { FAQSection } from "@/components/listing/FAQSection";
import { CarRail } from "@/components/marketing/CarRail";
import { useDiscoveryInventory } from "@/hooks/use-discovery-inventory";
import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { addDays } from "date-fns";
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
  const { data: inventory } = useDiscoveryInventory();

  // Trip dates: prefer ?start=&end= from search, otherwise default to next week
  const [startDate, setStartDate] = useState<Date>(() => {
    const s = searchParams.get("start");
    return s ? new Date(s) : addDays(new Date(), 7);
  });
  const [endDate, setEndDate] = useState<Date>(() => {
    const e = searchParams.get("end");
    return e ? new Date(e) : addDays(new Date(), 10);
  });

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
    return <DetailPageSkeleton />;
  }

  if (error || !car) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center p-4">
        <ErrorState
          title="Vehicle not found"
          description="This listing may have been removed or is no longer available."
          onRetry={() => navigate("/explore")}
        />
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

    const { data, error: bookingError } = await supabase.functions.invoke(
      "create-booking-draft",
      {
        body: {
          carId: carId!,
          startAt: startDate.toISOString(),
          endAt: endDate.toISOString(),
          selectedExtras,
          protectionPlanId: selectedPlanId,
          pickupLocation: car.location_label,
          returnLocation: car.location_label,
        },
      },
    );

    setReserving(false);
    const tripId = data && typeof data.tripId === "string" ? data.tripId : null;

    if (bookingError || !tripId) {
      toast({
        title: "Could not start your booking",
        description: "Please choose another date range or try again in a moment.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Reviewing your booking",
      description: "Your vehicle is temporarily held while you confirm and pay.",
    });
    navigate(`/checkout/${tripId}`);
  };

  const title = `${car.year} ${car.make} ${car.model}`;
  const city = car.location_label?.split(",")[0]?.trim() || "Canada";
  const notice = isDisabled
    ? "This vehicle is currently unavailable."
    : datesUnavailable
      ? "These dates aren't available — pick another range."
      : !user
        ? "You'll be asked to sign in."
        : null;
  const ctaLabel = !user ? "Sign in to continue" : reserving ? "Reserving…" : "Continue";
  const ctaDisabled = isDisabled || datesUnavailable || !quote;
  const onDatesChange = (s: Date, e: Date) => { setStartDate(s); setEndDate(e); };

  const similar = (inventory || [])
    .filter((c) => c.id !== car.id && (c.body_type === car.body_type || c.location_label === car.location_label))
    .slice(0, 8);

  return (
    <div className="min-h-dvh bg-background pb-44 md:pb-28 lg:pb-12 overflow-x-hidden">
      <Helmet>
        <title>{`${title} Rental ${city} | Rentauto`}</title>
        <meta name="description" content={`Rent this ${title} in ${city} with secure booking, protection options and flexible rental dates. From $${Math.round(car.base_daily_price_cents / 100)}/day.`} />
      </Helmet>

      <div className="mx-auto max-w-7xl px-4 pt-4 md:px-6">
        <Button variant="ghost" size="sm" className="mb-3 -ml-2" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" /> Back
        </Button>
        <PhotoGallery photos={car.photos} title={title} />
      </div>

      <div className="mx-auto grid max-w-7xl gap-10 px-4 pt-8 md:px-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <main className="min-w-0 space-y-10">
          <VehicleIdentity car={car} />
          {isDisabled && <DisabledVehicleBanner />}

          {car.description && (
            <section>
              <h2 className="mb-2 text-xl font-semibold">About this vehicle</h2>
              <p className="whitespace-pre-line text-muted-foreground">{car.description}</p>
            </section>
          )}

          <section>
            <h2 className="mb-3 text-xl font-semibold">Vehicle information</h2>
            <dl className="divide-y divide-border border-y border-border text-sm">
              <InfoRow label="Included kilometres" value={`${car.included_km_per_day} km/day · ${includedKmTotal} km this trip`} />
              <InfoRow label="Extra kilometre" value={`$${((quote?.extra_km_price ?? car.extra_km_price_cents) / 100).toFixed(2)}/km`} />
              <InfoRow label="Pickup" value={car.location_label || "Shared after booking"} />
              {car.consumption_l_per_100km ? <InfoRow label="Consumption" value={`${car.consumption_l_per_100km} L/100 km`} /> : null}
            </dl>
          </section>

          <VehicleFeaturesSection car={car} />
          <ExtrasSection extras={car.extras} />

          <div className="-mx-4 md:mx-0">
            <ProtectionPlanSelector selectedPlanId={selectedPlanId} onSelect={setSelectedPlanId} days={tripDays} />
          </div>

          <HostCardSection host={car.host} />

          <RatingsSection
            ratingAvg={car.rating_avg}
            ratingCount={car.rating_count}
            subRatings={car.sub_ratings}
            reviews={car.reviews}
          />

          <section>
            <h2 className="mb-2 text-xl font-semibold">Policies</h2>
            <PolicyAccordion rules={car.rules} cancellation={quote?.cancellation_policy_snapshot ?? car.cancellation_policy} />
          </section>

          <FAQSection />
        </main>

        <aside className="hidden lg:block" aria-label="Booking">
          <div className="sticky top-24">
            <BookingPanel
              dailyCents={car.base_daily_price_cents}
              startDate={startDate}
              endDate={endDate}
              onDatesChange={onDatesChange}
              pickupLabel={car.location_label}
              quote={quote}
              quoteLoading={quoteLoading}
              notice={notice}
              ctaLabel={ctaLabel}
              disabled={ctaDisabled}
              busy={reserving}
              onContinue={handleReserve}
            />
          </div>
        </aside>
      </div>

      {/* Mobile: full panel inline, plus sticky action */}
      <div className="mx-auto max-w-7xl px-4 pt-8 lg:hidden" id="book">
        <BookingPanel
          dailyCents={car.base_daily_price_cents}
          startDate={startDate}
          endDate={endDate}
          onDatesChange={onDatesChange}
          pickupLabel={car.location_label}
          quote={quote}
          quoteLoading={quoteLoading}
          notice={notice}
          ctaLabel={ctaLabel}
          disabled={ctaDisabled}
          busy={reserving}
          onContinue={handleReserve}
        />
      </div>

      {similar.length > 0 && (
        <div className="mx-auto max-w-7xl pt-12">
          <CarRail title="Similar vehicles nearby" cars={similar} tripDays={tripDays} />
        </div>
      )}

      <div className="lg:hidden">
        <StickyCheckoutBar
          originalCents={quote?.base_price ?? baseTotalCents}
          totalCents={totalBeforeTax}
          disabled={ctaDisabled}
          loading={quoteLoading || reserving}
          ctaLabel={ctaLabel}
          onReserve={handleReserve}
        />
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
