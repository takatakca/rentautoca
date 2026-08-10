import { lazy, Suspense, useMemo } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Plane, Shield, Smartphone, CheckCircle2, Lock, Eye,
  Search, KeyRound, Car as CarIcon, Flag, Heart, Bell, MapPin,
} from "lucide-react";
import { EditorialHero } from "@/components/marketing/EditorialHero";
import { DestinationTiles } from "@/components/marketing/DestinationTiles";
import { ShowroomCategories } from "@/components/marketing/ShowroomCategories";
import { CarRail } from "@/components/marketing/CarRail";
import { OffersSection } from "@/components/marketing/OffersSection";
import { TrackRentalCard } from "@/components/marketing/TrackRentalCard";
import { useDiscoveryInventory, haversineKm, DiscoveryCar } from "@/hooks/use-discovery-inventory";
import { useNearbyLocation } from "@/hooks/use-nearby-location";
import { useRecentlyViewed } from "@/hooks/use-recently-viewed";
import { exploreUrl } from "@/lib/search-state";
import { CarCardGridSkeleton } from "@/components/ui/skeletons";
import yulImg from "@/assets/loc-yul.jpg";
import monthlyImg from "@/assets/monthly-dark.jpg";
import evImg from "@/assets/ev.jpg";
import hostImg from "@/assets/host.jpg";

const FAQSection = lazy(() =>
  import("@/components/marketing/MarketingPage").then((m) => ({ default: m.FAQSection }))
);

const trustItems = [
  { icon: Shield, title: "Protection plans", body: "Three coverage tiers — Basic, Silver, and Gold — chosen at checkout for every trip.", to: "/insurance" },
  { icon: Eye, title: "Verified hosts & guests", body: "Government ID, driver's licence and host vehicle documents reviewed before any trip starts.", to: "/safety" },
  { icon: Lock, title: "Privacy-first GPS", body: "Tracking runs only while a trip is active and stops the moment the car is returned.", to: "/tracking" },
];

const steps = [
  { icon: Search, title: "Search", body: "Tell Rentauto where and when — by voice, plain language, or filters." },
  { icon: KeyRound, title: "Book", body: "Compare protection, see the full quote, and reserve with a secure payment." },
  { icon: CarIcon, title: "Pick up", body: "Meet the host, take walk-around photos, log odometer and fuel in the app." },
  { icon: Flag, title: "Drive & return", body: "Check out with photos, close the trip, and your GPS session ends automatically." },
];

const faqs = [
  { q: "Where does Rentauto operate?", a: "We're focused on Quebec — Montreal, Quebec City, Laval, Longueuil, Gatineau, Sherbrooke — with active expansion across Canada. You can browse and book in CAD." },
  { q: "Do I need to be 21 to rent?", a: "Most listings require drivers to be at least 21 with a valid Canadian or international driver's licence held for 12+ months. Some hosts allow 19+ with a young-driver fee." },
  { q: "Is insurance included?", a: "Every booking includes a protection plan with liability coverage and damage protection. You can upgrade to Silver or Gold for lower deductibles and added benefits like roadside assistance." },
  { q: "How does pickup work?", a: "You meet the host at the agreed location (home, office, or airport curb-side), do a quick walk-around with photos in the app, and drive off. Return is the same in reverse." },
  { q: "Does voice search send my audio anywhere?", a: "No. Voice search uses your browser's built-in speech recognition. Rentauto never uploads recordings, and you can always type instead." },
  { q: "What if there's an issue during my trip?", a: "Report incidents directly from the trip screen. Silver and Gold plans include 24/7 roadside assistance. Our support team is reachable at support@rentauto.ca." },
];

const MONTREAL = { lat: 45.5019, lng: -73.5674 };

export default function Home() {
  const { user, hasRole, displayName } = useAuth();
  const { data: inventory, isLoading } = useDiscoveryInventory();
  const { coords, status: geoStatus, request: requestGeo } = useNearbyLocation();
  const { items: recentlyViewed } = useRecentlyViewed();

  const cars: DiscoveryCar[] = useMemo(() => inventory ?? [], [inventory]);

  const nearby = useMemo(() => {
    const origin = coords ?? MONTREAL;
    return cars
      .filter((c) => c.lat !== null && c.lng !== null)
      .map((c) => ({ ...c, distance_km: haversineKm(origin, { lat: c.lat!, lng: c.lng! }) }))
      .sort((a, b) => (a.distance_km ?? 0) - (b.distance_km ?? 0))
      .slice(0, 8);
  }, [cars, coords]);

  const availableToday = useMemo(() => cars.filter((c) => c.available_today).slice(0, 8), [cars]);
  const airportCars = useMemo(() => cars.filter((c) => c.airport_pickup_enabled).slice(0, 8), [cars]);
  const monthlyCars = useMemo(() => cars.filter((c) => c.monthly_enabled).slice(0, 8), [cars]);
  const evCars = useMemo(() => cars.filter((c) => /electric/i.test(c.fuel_type)).slice(0, 8), [cars]);
  const bestValue = useMemo(
    () => [...cars].sort((a, b) => a.base_daily_price_cents - b.base_daily_price_cents).slice(0, 8),
    [cars]
  );

  const { data: personal } = useQuery({
    queryKey: ["home-personal", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const [favRes, notifRes] = await Promise.all([
        supabase.from("favorites").select("car_id").order("created_at", { ascending: false }).limit(8),
        supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
      ]);
      return {
        favoriteIds: (favRes.data || []).map((f) => f.car_id),
        unread: notifRes.count ?? 0,
      };
    },
  });

  const favoriteCars = useMemo(
    () => cars.filter((c) => personal?.favoriteIds?.includes(c.id)).slice(0, 8),
    [cars, personal]
  );

  const recentCars = useMemo(
    () => recentlyViewed.map((r) => cars.find((c) => c.id === r.id)).filter(Boolean) as DiscoveryCar[],
    [recentlyViewed, cars]
  );

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <div className="pb-24 md:pb-0 overflow-x-hidden">
      <EditorialHero availableToday={isLoading ? undefined : availableToday.length} />

      {/* SIGNED-IN STRIP */}
      {user && (
        <section className="container -mt-6 md:-mt-10 relative z-10">
          <div className="grid gap-4 md:grid-cols-[1fr_minmax(0,380px)] items-start">
            <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-lg shadow-foreground/5">
              <p className="text-sm text-muted-foreground">{greeting}</p>
              <p className="font-semibold text-lg">{displayName || "Welcome back"}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm" className="rounded-full gap-1.5">
                  <Link to="/dashboard"><Smartphone className="h-3.5 w-3.5" /> Dashboard</Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="rounded-full gap-1.5">
                  <Link to="/dashboard/notifications">
                    <Bell className="h-3.5 w-3.5" /> Alerts{personal?.unread ? ` (${personal.unread})` : ""}
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="rounded-full gap-1.5">
                  <Link to="/dashboard/favorites"><Heart className="h-3.5 w-3.5" /> Saved</Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="rounded-full gap-1.5">
                  <Link to="/dashboard/trips"><CarIcon className="h-3.5 w-3.5" /> Trips</Link>
                </Button>
              </div>
            </div>
            <TrackRentalCard />
          </div>
        </section>
      )}

      <DestinationTiles />

      <ShowroomCategories />

      {isLoading && (
        <div className="container py-10">
          <CarCardGridSkeleton />
        </div>
      )}

      {/* NEAR YOU */}
      {!isLoading && nearby.length > 0 && (
        <div>
          <CarRail
            title="Cars near you"
            subtitle={
              geoStatus === "granted"
                ? "Closest active listings to your approximate location."
                : "Showing the Montreal area — allow location for closer matches."
            }
            cars={nearby}
            seeAllHref={exploreUrl({ location: geoStatus === "granted" ? undefined : "Montreal" })}
          />
          {geoStatus !== "granted" && geoStatus !== "denied" && (
            <div className="container -mt-4 pb-4">
              <Button variant="outline" size="sm" className="rounded-full gap-1.5" onClick={requestGeo}>
                <MapPin className="h-3.5 w-3.5" /> Use my location
              </Button>
            </div>
          )}
        </div>
      )}

      {recentCars.length > 0 && (
        <CarRail title="Continue browsing" subtitle="Vehicles you looked at recently." cars={recentCars} />
      )}
      {favoriteCars.length > 0 && (
        <CarRail
          title="Based on your favorites"
          subtitle="Saved cars that are still active."
          cars={favoriteCars}
          seeAllHref="/dashboard/favorites"
        />
      )}

      {!isLoading && <OffersSection cars={cars} />}

      <CarRail title="Available this weekend" subtitle="No blocks on the calendar right now." cars={availableToday} seeAllHref={exploreUrl({})} />
      <CarRail title="Best value" subtitle="Lowest daily rates across active listings." cars={bestValue} seeAllHref={exploreUrl({ sort: "price_asc" })} />

      {/* AIRPORT STORY — full-bleed editorial */}
      <section className="relative isolate my-4">
        <img
          src={yulImg}
          alt="Traveller collecting a rental car at Montréal-Trudeau airport"
          loading="lazy"
          decoding="async"
          width={1600}
          height={1000}
          className="absolute inset-0 -z-10 h-full w-full object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-overlay/75 md:bg-gradient-to-r md:from-overlay/90 md:via-overlay/70 md:to-overlay/30" />
        <div className="container py-16 md:py-24">
          <div className="max-w-xl">
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-overlay-muted">
              <Plane className="h-4 w-4" aria-hidden="true" /> Airport
            </p>
            <h2 className="mt-3 text-3xl md:text-5xl font-bold tracking-tight text-overlay-foreground">
              Land at YUL. Drive out in twenty minutes.
            </h2>
            <p className="mt-4 text-overlay-muted">
              Hosts at Montréal-Trudeau and Québec City Jean Lesage meet you curb-side or in the designated lot.
              No counter, no queue — pickup instructions live on every listing.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg" className="rounded-full">
                <Link to={exploreUrl({ location: "YUL Airport", airport: true, category: "Airports" })}>YUL cars</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full bg-overlay-foreground/10 text-overlay-foreground border-overlay-foreground/30 hover:bg-overlay-foreground/20 hover:text-overlay-foreground">
                <Link to={exploreUrl({ location: "YQB Airport", airport: true, category: "Airports" })}>YQB cars</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {airportCars.length > 0 && (
        <CarRail title="Airport-ready vehicles" subtitle="Hosts who deliver to the terminal." cars={airportCars} seeAllHref="/airport-rentals" />
      )}

      {/* MONTHLY + EV — split editorial */}
      <section className="container py-12 md:py-20 grid gap-6 md:grid-cols-2">
        <article className="relative isolate overflow-hidden rounded-3xl min-h-[380px] flex">
          <img
            src={monthlyImg}
            alt="Premium sedan available for monthly rental"
            loading="lazy"
            decoding="async"
            width={1600}
            height={1008}
            className="absolute inset-0 -z-10 h-full w-full object-cover"
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-overlay/95 via-overlay/65 to-overlay/25" />
          <div className="mt-auto p-7 md:p-9">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-overlay-muted">Monthly</p>
            <h2 className="mt-2 text-2xl md:text-3xl font-bold tracking-tight text-overlay-foreground">
              Staying a month or longer?
            </h2>
            <p className="mt-3 text-sm text-overlay-muted max-w-md">
              Same verified car, no counter visits, included kilometres printed on every listing.
            </p>
            <Button asChild className="mt-5 rounded-full">
              <Link to="/monthly-car-rentals">Explore monthly rentals</Link>
            </Button>
          </div>
        </article>

        <article className="relative isolate overflow-hidden rounded-3xl min-h-[380px] flex">
          <img
            src={evImg}
            alt="Electric car charging at a public station"
            loading="lazy"
            decoding="async"
            width={1600}
            height={1008}
            className="absolute inset-0 -z-10 h-full w-full object-cover"
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-overlay/95 via-overlay/60 to-overlay/10" />
          <div className="mt-auto p-7 md:p-9">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-overlay-muted">Electric</p>
            <h2 className="mt-2 text-2xl md:text-3xl font-bold tracking-tight text-overlay-foreground">
              Skip the pump entirely.
            </h2>
            <p className="mt-3 text-sm text-overlay-muted max-w-md">
              EVs with charging notes from the host, plus Quebec's public network mapped on every listing.
            </p>
            <Button asChild className="mt-5 rounded-full">
              <Link to="/electric-vehicles">Browse electric</Link>
            </Button>
          </div>
        </article>
      </section>

      {evCars.length > 0 && (
        <CarRail title="Electric favorites" subtitle="Charge at home, skip the pump." cars={evCars} seeAllHref="/electric-vehicles" />
      )}
      {monthlyCars.length > 0 && (
        <CarRail title="Monthly-eligible cars" subtitle="Hosts open to long stays." cars={monthlyCars} seeAllHref="/monthly-car-rentals" />
      )}

      {/* HOW IT WORKS — numbered editorial narrative */}
      <section className="border-y border-border/60 bg-secondary/40">
        <div className="container py-14 md:py-20">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">How it works</p>
            <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">Four steps, keys in hand.</h2>
          </div>
          <ol className="mt-10 grid gap-8 md:grid-cols-4">
            {steps.map((s, i) => (
              <li key={s.title} className="border-t-2 border-foreground/10 pt-5">
                <span className="block text-4xl md:text-5xl font-bold tracking-tight text-foreground/15">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-3 flex items-center gap-2 font-semibold">
                  <s.icon className="h-4 w-4 text-primary" aria-hidden="true" />
                  {s.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* TRUST BAND */}
      <section className="container py-14 md:py-20">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Trust &amp; safety</p>
          <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">Built for confident driving</h2>
          <p className="mt-3 text-muted-foreground">
            Protection plans, verified identities, photo trip records, secure payments and Quebec-based support.
          </p>
        </div>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {trustItems.map((item) => (
            <Link key={item.title} to={item.to} className="rounded-2xl border border-border/60 bg-card p-6 hover:border-primary/40 motion-safe:hover:-translate-y-0.5 transition-all">
              <div className="w-11 h-11 rounded-xl bg-accent text-accent-foreground flex items-center justify-center mb-4">
                <item.icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="font-semibold mb-1.5">{item.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{item.body}</p>
            </Link>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild variant="outline" className="rounded-full"><Link to="/safety">Safety overview</Link></Button>
          <Button asChild variant="outline" className="rounded-full"><Link to="/insurance">Insurance &amp; protection</Link></Button>
          <Button asChild variant="outline" className="rounded-full"><Link to="/tracking">How GPS works</Link></Button>
          <Button asChild variant="outline" className="rounded-full"><Link to="/help">Help centre</Link></Button>
        </div>
      </section>

      {/* HOST CTA */}
      {(!user || !hasRole("host")) && (
        <section className="relative isolate">
          <img
            src={hostImg}
            alt="Host handing car keys to a guest in a Quebec driveway"
            loading="lazy"
            decoding="async"
            width={1600}
            height={1008}
            className="absolute inset-0 -z-10 h-full w-full object-cover"
          />
          <div className="absolute inset-0 -z-10 bg-overlay/80 md:bg-gradient-to-r md:from-overlay/92 md:via-overlay/70 md:to-overlay/20" />
          <div className="container py-16 md:py-24">
            <div className="max-w-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-overlay-muted">For hosts</p>
              <h2 className="mt-3 text-3xl md:text-5xl font-bold tracking-tight text-overlay-foreground">
                Your car can earn when you're not using it.
              </h2>
              <ul className="mt-6 space-y-2 text-sm text-overlay-muted">
                <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-overlay-foreground mt-0.5 shrink-0" /> You set price, mileage and availability</li>
                <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-overlay-foreground mt-0.5 shrink-0" /> Verified guests, photo check-in, in-trip GPS</li>
                <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-overlay-foreground mt-0.5 shrink-0" /> Direct deposit payouts in CAD</li>
              </ul>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button asChild size="lg" className="rounded-full">
                  <Link to={user ? "/become-host" : "/signup"}>{user ? "Become a host" : "Get started"}</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="rounded-full bg-overlay-foreground/10 text-overlay-foreground border-overlay-foreground/30 hover:bg-overlay-foreground/20 hover:text-overlay-foreground">
                  <Link to="/for-hosts">Learn more</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      <div className="container max-w-5xl py-14 md:py-20">
        <Suspense fallback={<div className="h-40" />}>
          <FAQSection items={faqs} />
        </Suspense>
      </div>

      {/* FINAL CTA */}
      <section className="container max-w-5xl pb-14 md:pb-20">
        <div className="rounded-3xl border border-border/60 bg-card p-8 md:p-12 text-center">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Your next trip starts here.</h2>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
            Search cars across Quebec, book in minutes, and drive away with confidence.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="rounded-full"><Link to="/explore">Browse cars</Link></Button>
            <Button asChild size="lg" variant="outline" className="rounded-full"><Link to="/how-it-works">How it works</Link></Button>
          </div>
          <nav aria-label="Popular pages" className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            <Link to="/airport-rentals" className="hover:text-primary">Airport rentals</Link>
            <Link to="/monthly-car-rentals" className="hover:text-primary">Monthly rentals</Link>
            <Link to="/electric-vehicles" className="hover:text-primary">Electric vehicles</Link>
            <Link to="/luxury-rentals" className="hover:text-primary">Luxury rentals</Link>
            <Link to="/for-hosts" className="hover:text-primary">For hosts</Link>
            <Link to="/safety" className="hover:text-primary">Safety</Link>
            <Link to="/tracking" className="hover:text-primary">Tracking</Link>
          </nav>
        </div>
      </section>
    </div>
  );
}
