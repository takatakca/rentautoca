import { lazy, Suspense, useMemo } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Plane, Shield, Smartphone, ArrowRight, CheckCircle2, Lock, Eye,
  Search, KeyRound, Car as CarIcon, Flag, Heart, Bell, MapPin, Sparkles,
} from "lucide-react";
import { SmartSearchConsole } from "@/components/marketing/SmartSearchConsole";
import { CarRail } from "@/components/marketing/CarRail";
import { CategoryDiscovery } from "@/components/marketing/CategoryDiscovery";
import { OffersSection } from "@/components/marketing/OffersSection";
import { TrackRentalCard } from "@/components/marketing/TrackRentalCard";
import { useDiscoveryInventory, haversineKm, DiscoveryCar } from "@/hooks/use-discovery-inventory";
import { useNearbyLocation } from "@/hooks/use-nearby-location";
import { useRecentlyViewed } from "@/hooks/use-recently-viewed";
import { exploreUrl } from "@/lib/search-state";
import { CarCardGridSkeleton } from "@/components/ui/skeletons";

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

  // Personalized: favorites + unread notifications (only when signed in)
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
      {/* HERO — mobility command center */}
      <section className="relative overflow-hidden border-b border-border/60 bg-gradient-to-br from-accent/40 via-background to-background">
        <div className="absolute inset-0 -z-10 opacity-40 pointer-events-none" aria-hidden="true">
          <div className="absolute top-1/4 -left-32 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute top-0 right-0 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        </div>

        <div className="container py-8 md:py-16 lg:py-20">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-8 lg:gap-12 items-start">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="text-[11px] md:text-xs font-semibold uppercase tracking-widest text-primary">
                  Quebec mobility platform
                </span>
                {!isLoading && cars.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-card border border-border">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary motion-safe:animate-pulse" aria-hidden="true" />
                    {availableToday.length} car{availableToday.length === 1 ? "" : "s"} available today
                  </span>
                )}
              </div>

              <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground max-w-3xl">
                Your next car is already nearby.
              </h1>
              <p className="mt-4 text-base md:text-lg text-muted-foreground max-w-2xl">
                Search verified vehicles across Quebec, compare protection, book instantly, and manage your entire
                trip from Rentauto.
              </p>

              <div className="mt-6 md:mt-8">
                <SmartSearchConsole />
              </div>

              <p className="mt-4 text-xs text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                Ask in plain language or tap the microphone — speech stays on your device.
              </p>
            </div>

            <div className="w-full space-y-4">
              <TrackRentalCard />
              {user && (
                <div className="rounded-2xl border border-border/60 bg-card p-5">
                  <p className="text-sm text-muted-foreground">{greeting}</p>
                  <p className="font-semibold text-lg">{displayName || "Welcome back"}</p>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Button asChild variant="outline" size="sm" className="rounded-full justify-start gap-1.5">
                      <Link to="/dashboard"><Smartphone className="h-3.5 w-3.5" /> Dashboard</Link>
                    </Button>
                    <Button asChild variant="outline" size="sm" className="rounded-full justify-start gap-1.5">
                      <Link to="/dashboard/notifications">
                        <Bell className="h-3.5 w-3.5" /> Alerts{personal?.unread ? ` (${personal.unread})` : ""}
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm" className="rounded-full justify-start gap-1.5">
                      <Link to="/dashboard/favorites"><Heart className="h-3.5 w-3.5" /> Saved</Link>
                    </Button>
                    <Button asChild variant="outline" size="sm" className="rounded-full justify-start gap-1.5">
                      <Link to="/dashboard/trips"><CarIcon className="h-3.5 w-3.5" /> Trips</Link>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* CATEGORY DISCOVERY */}
      <CategoryDiscovery />

      {isLoading && (
        <div className="container pb-8">
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

      {/* PERSONALIZED RAILS */}
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

      {/* DEALS */}
      {!isLoading && <OffersSection cars={cars} />}

      {/* RECOMMENDATION RAILS */}
      <CarRail title="Available this weekend" subtitle="No blocks on the calendar right now." cars={availableToday} seeAllHref={exploreUrl({})} />
      <CarRail title="Best value" subtitle="Lowest daily rates across active listings." cars={bestValue} seeAllHref={exploreUrl({ sort: "price_asc" })} />

      {/* AIRPORT */}
      {airportCars.length > 0 && (
        <section className="border-y border-border/60 bg-card/30">
          <div className="container py-10 md:py-14">
            <div className="flex items-start gap-3 mb-2">
              <span className="w-10 h-10 rounded-xl bg-accent text-accent-foreground flex items-center justify-center shrink-0">
                <Plane className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Pickup at the airport</h2>
                <p className="text-muted-foreground mt-1">
                  Montréal-Trudeau (YUL) and Québec City Jean Lesage (YQB). Hosts meet you curb-side or in the
                  designated lot — pickup instructions are on each listing.
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm" className="rounded-full">
                <Link to={exploreUrl({ location: "YUL Airport", airport: true, category: "Airports" })}>YUL cars</Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="rounded-full">
                <Link to={exploreUrl({ location: "YQB Airport", airport: true, category: "Airports" })}>YQB cars</Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="rounded-full">
                <Link to="/airport-rentals">Airport rental guide</Link>
              </Button>
            </div>
          </div>
          <CarRail title="Airport-ready vehicles" cars={airportCars} seeAllHref="/airport-rentals" />
        </section>
      )}

      {/* MONTHLY */}
      {monthlyCars.length > 0 && (
        <section className="container py-10 md:py-14">
          <div className="rounded-3xl border border-primary/20 bg-gradient-to-br from-accent/50 via-card to-card p-6 md:p-10">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Staying a month or longer?</h2>
            <p className="mt-2 text-muted-foreground max-w-2xl">
              Monthly-enabled hosts keep the same verified vehicle available for extended stays, with the included
              kilometre allowance shown on every listing. Estimates below; your final total always comes from checkout.
            </p>
            <ul className="mt-5 grid gap-2 sm:grid-cols-3 text-sm">
              <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" /> Same car, no counter visits</li>
              <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" /> Included km per day on every listing</li>
              <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" /> Extend or end according to the host's policy</li>
            </ul>
            <Button asChild className="mt-6 rounded-full">
              <Link to="/monthly-car-rentals">Explore monthly rentals</Link>
            </Button>
          </div>
          <CarRail title="Monthly-eligible cars" cars={monthlyCars} seeAllHref="/monthly-car-rentals" />
        </section>
      )}

      {/* EV */}
      {evCars.length > 0 && (
        <CarRail title="Electric favorites" subtitle="Charge at home, skip the pump." cars={evCars} seeAllHref="/electric-vehicles" />
      )}

      {/* HOW IT WORKS */}
      <section className="border-y border-border/60 bg-card/30">
        <div className="container py-12 md:py-16">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">How Rentauto works</h2>
          <ol className="mt-8 grid gap-5 md:grid-cols-4">
            {steps.map((s, i) => (
              <li key={s.title} className="rounded-2xl border border-border/60 bg-card p-6">
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-10 h-10 rounded-xl bg-accent text-accent-foreground flex items-center justify-center">
                    <s.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="text-xs font-semibold text-muted-foreground">Step {i + 1}</span>
                </div>
                <h3 className="font-semibold mb-1.5">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-sm text-muted-foreground">
            Track and manage everything from your{" "}
            <Link to="/dashboard" className="text-primary font-medium hover:underline">Rentauto dashboard</Link>.
          </p>
        </div>
      </section>

      {/* TRUST */}
      <section className="container py-12 md:py-16">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Trust &amp; safety</p>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Built for confident driving</h2>
          <p className="mt-2 text-muted-foreground">
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
        <section className="container pb-12 md:pb-16">
          <div className="rounded-3xl border border-primary/20 bg-gradient-to-br from-accent/60 via-card to-card p-8 md:p-12 grid md:grid-cols-2 gap-8 items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">For hosts</p>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                Your car can earn when you're not using it.
              </h2>
              <p className="mt-3 text-muted-foreground">
                List in minutes, control your availability, and follow every active rental from the host dashboard.
                All host accounts are reviewed before going live.
              </p>
              <ul className="mt-5 space-y-2 text-sm">
                <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" /> You set price, mileage and availability</li>
                <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" /> Verified guests, photo check-in, in-trip GPS</li>
                <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" /> Direct deposit payouts in CAD</li>
              </ul>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild size="lg" className="rounded-full">
                  <Link to={user ? "/become-host" : "/signup"}>{user ? "Become a host" : "Get started"}</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="rounded-full">
                  <Link to="/for-hosts">Learn more</Link>
                </Button>
              </div>
            </div>
            <div className="hidden md:flex justify-center">
              <div className="relative w-full max-w-xs aspect-[3/4] rounded-3xl bg-gradient-to-br from-primary/15 via-card to-card border border-border/60 p-6 flex flex-col">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Smartphone className="h-3.5 w-3.5" aria-hidden="true" /> Host dashboard
                </div>
                <p className="mt-4 text-sm text-muted-foreground">Availability, trips, payouts and live rentals in one place.</p>
                <div className="mt-6 space-y-2">
                  <div className="rounded-lg bg-background/60 p-3 text-xs">
                    <div className="font-medium">Set your own price</div>
                    <div className="text-muted-foreground mt-0.5">Daily rate, included km, extras</div>
                  </div>
                  <div className="rounded-lg bg-background/60 p-3 text-xs">
                    <div className="font-medium">Approve every booking</div>
                    <div className="text-muted-foreground mt-0.5">Or switch on instant book</div>
                  </div>
                  <div className="rounded-lg bg-background/60 p-3 text-xs">
                    <div className="font-medium">Track active rentals</div>
                    <div className="text-muted-foreground mt-0.5">GPS only while a trip runs</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      <div className="container max-w-5xl pb-12 md:pb-16">
        <Suspense fallback={<div className="h-40" />}>
          <FAQSection items={faqs} />
        </Suspense>
      </div>

      {/* FINAL CTA */}
      <section className="container max-w-5xl pb-12 md:pb-20">
        <div className="rounded-3xl border border-primary/20 bg-gradient-to-br from-accent/60 via-card to-card p-8 md:p-12 text-center">
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
