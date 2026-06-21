import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Car, Plane, CalendarDays, Zap, Sparkles, Shield,
  MapPin, Heart, Smartphone, ArrowRight, CheckCircle2, Lock, Eye,
} from "lucide-react";
import { HeroSearch } from "@/components/marketing/HeroSearch";
import { FAQSection } from "@/components/marketing/MarketingPage";

const categoryTiles = [
  { to: "/airport-rentals", icon: Plane, label: "Airport rentals", body: "Pick up at YUL or YQB" },
  { to: "/monthly-car-rentals", icon: CalendarDays, label: "Monthly rentals", body: "Long-stay discounts" },
  { to: "/electric-vehicles", icon: Zap, label: "Electric vehicles", body: "Tesla, Polestar, Ioniq" },
  { to: "/luxury-rentals", icon: Sparkles, label: "Luxury rentals", body: "BMW, Mercedes, Porsche" },
];

const trustItems = [
  { icon: Shield, title: "Protection plans", body: "Three coverage tiers — Basic, Silver, and Gold — included with every trip." },
  { icon: Eye, title: "Verified hosts & guests", body: "Government ID, driver's licence and host vehicle verification before any trip starts." },
  { icon: Lock, title: "Privacy-first GPS", body: "Tracking is only active during the rental window and disabled the moment the trip ends." },
];

const faqs = [
  { q: "Where does Rentauto operate?", a: "We're focused on Quebec — Montreal, Quebec City, Laval, Longueuil, Gatineau, Sherbrooke — with active expansion across Canada. You can browse and book in CAD." },
  { q: "Do I need to be 21 to rent?", a: "Most listings require drivers to be at least 21 with a valid Canadian or international driver's licence held for 12+ months. Some hosts allow 19+ with a young-driver fee." },
  { q: "Is insurance included?", a: "Every booking includes a protection plan with liability coverage and damage protection. You can upgrade to Silver or Gold for lower deductibles and added benefits like roadside assistance." },
  { q: "How does pickup work?", a: "You meet the host at the agreed location (home, office, or airport curb-side), do a quick walk-around with photos in the app, and drive off. Return is the same in reverse." },
  { q: "What if there's an issue during my trip?", a: "Report incidents directly from the trip screen. Silver and Gold plans include 24/7 roadside assistance. Our support team is reachable at support@rentauto.ca." },
];

export default function Home() {
  const { user, hasRole } = useAuth();

  const { data: cars } = useQuery({
    queryKey: ["home-listings"],
    queryFn: async () => {
      const { data: carsData } = await supabase
        .from("cars")
        .select("id, make, model, year, base_daily_price_cents, location_label, body_type, status")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(8);
      if (!carsData || carsData.length === 0) return [];
      const carIds = carsData.map((c) => c.id);
      const { data: photos } = await supabase
        .from("car_photos")
        .select("car_id, url")
        .in("car_id", carIds)
        .order("sort_order");
      const photoMap: Record<string, string> = {};
      (photos || []).forEach((p) => { if (!photoMap[p.car_id]) photoMap[p.car_id] = p.url; });
      return carsData.map((car) => ({ ...car, photo_url: photoMap[car.id] || null }));
    },
  });

  const placeholderCars = [
    { id: "p1", make: "Tesla", model: "Model 3", year: 2023, location_label: "Montreal, QC", base_daily_price_cents: 11000, photo_url: null, body_type: "Sedan" },
    { id: "p2", make: "BMW", model: "X4 M40i", year: 2024, location_label: "Laval, QC", base_daily_price_cents: 18900, photo_url: null, body_type: "SUV" },
    { id: "p3", make: "Honda", model: "Civic", year: 2023, location_label: "Quebec City, QC", base_daily_price_cents: 5500, photo_url: null, body_type: "Sedan" },
    { id: "p4", make: "Mercedes-Benz", model: "C300", year: 2022, location_label: "Montreal, QC", base_daily_price_cents: 15500, photo_url: null, body_type: "Sedan" },
  ];
  const displayCars = cars && cars.length > 0 ? cars : placeholderCars;

  return (
    <div className="pb-24 md:pb-0">
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-border/60 bg-gradient-to-br from-accent/40 via-background to-background">
        <div className="absolute inset-0 -z-10 opacity-40 pointer-events-none">
          <div className="absolute top-1/4 -left-32 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute top-0 right-0 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        </div>
        <div className="container py-10 md:py-20 max-w-5xl">
          <p className="text-xs md:text-sm font-semibold uppercase tracking-widest text-primary mb-3">
            Rent cars across Quebec
          </p>
          <h1 className="text-3xl md:text-6xl font-bold tracking-tight text-foreground max-w-3xl">
            Skip the rental counter. Drive what you actually want.
          </h1>
          <p className="mt-4 md:mt-5 text-base md:text-lg text-muted-foreground max-w-2xl">
            Book unique cars from trusted local hosts in Montreal, Quebec City, Laval and across Canada — by the day, week, or month.
          </p>
          <div className="mt-7 md:mt-9">
            <HeroSearch />
          </div>
        </div>
      </section>

      {/* CATEGORY TILES */}
      <section className="container py-12 md:py-16">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Find the right ride</h2>
            <p className="text-muted-foreground mt-1">From airport pickups to month-long stays.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {categoryTiles.map((tile) => (
            <Link
              key={tile.to}
              to={tile.to}
              className="group rounded-2xl border border-border/60 bg-card p-5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all"
            >
              <div className="w-11 h-11 rounded-xl bg-accent text-accent-foreground flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <tile.icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold">{tile.label}</h3>
              <p className="text-sm text-muted-foreground mt-1">{tile.body}</p>
              <span className="mt-3 inline-flex items-center text-sm text-primary font-medium">
                Browse <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* FEATURED CARS */}
      <section className="container pb-12 md:pb-16">
        <div className="flex items-end justify-between mb-6">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Featured this week</h2>
          <Link to="/explore" className="text-sm text-primary font-medium hover:underline">
            See all cars
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {displayCars.slice(0, 4).map((car) => (
            <Link
              key={car.id}
              to={car.id.startsWith("p") ? "/explore" : `/cars/${car.id}`}
              className="group block"
            >
              <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-muted mb-2">
                {car.photo_url ? (
                  <img src={car.photo_url} alt={`${car.make} ${car.model}`} loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-accent/50 to-muted flex items-center justify-center">
                    <Car className="h-10 w-10 text-muted-foreground/30" />
                  </div>
                )}
                <span className="absolute top-2 right-2 w-8 h-8 rounded-full bg-background/70 backdrop-blur-sm flex items-center justify-center">
                  <Heart className="h-4 w-4 text-foreground" />
                </span>
              </div>
              <h3 className="font-bold text-sm">{car.make} {car.model} {car.year}</h3>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {car.location_label}
              </p>
              <p className="mt-1 text-sm font-semibold">
                ${(car.base_daily_price_cents / 100).toFixed(0)}
                <span className="font-normal text-muted-foreground">/day</span>
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* TRUST */}
      <section className="border-y border-border/60 bg-card/30">
        <div className="container py-12 md:py-16 max-w-5xl">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Trust & safety</p>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Built for confident driving</h2>
            <p className="mt-2 text-muted-foreground">
              Every booking is backed by protection plans, verified identities, and transparent in-trip tracking.
            </p>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {trustItems.map((item) => (
              <div key={item.title} className="rounded-2xl border border-border/60 bg-card p-6">
                <div className="w-11 h-11 rounded-xl bg-accent text-accent-foreground flex items-center justify-center mb-4">
                  <item.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold mb-1.5">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/safety">Safety overview</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/insurance">Insurance & protection</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/tracking">How GPS works</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* HOST CTA */}
      {(!user || !hasRole("host")) && (
        <section className="container py-12 md:py-16">
          <div className="rounded-3xl border border-primary/20 bg-gradient-to-br from-accent/60 via-card to-card p-8 md:p-12 grid md:grid-cols-2 gap-8 items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">For hosts</p>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                Turn your car into income, on your schedule.
              </h2>
              <p className="mt-3 text-muted-foreground">
                List in minutes. Approve every booking. Get paid via Stripe when each trip wraps up.
              </p>
              <ul className="mt-5 space-y-2 text-sm">
                <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" /> You set price, mileage and availability</li>
                <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" /> Verified guests, photo check-in, in-trip GPS</li>
                <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" /> Direct deposit payouts in CAD</li>
              </ul>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild size="lg" className="rounded-full">
                  <Link to={user ? "/become-host" : "/signup"}>
                    {user ? "Start hosting" : "Get started"}
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="rounded-full">
                  <Link to="/for-hosts">Learn more</Link>
                </Button>
              </div>
            </div>
            <div className="hidden md:flex justify-center">
              <div className="relative w-full max-w-xs aspect-[3/4] rounded-3xl bg-gradient-to-br from-primary/15 via-card to-card border border-border/60 p-6 flex flex-col">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Smartphone className="h-3.5 w-3.5" /> Host dashboard
                </div>
                <p className="mt-4 text-3xl font-bold">$1,240</p>
                <p className="text-xs text-muted-foreground">Earned this month</p>
                <div className="mt-6 space-y-2">
                  <div className="rounded-lg bg-background/60 p-3 text-xs">
                    <div className="font-medium">Tesla Model 3 · 4 trips</div>
                    <div className="text-muted-foreground mt-0.5">Next trip · Fri Jun 26</div>
                  </div>
                  <div className="rounded-lg bg-background/60 p-3 text-xs">
                    <div className="font-medium">Honda Civic · 6 trips</div>
                    <div className="text-muted-foreground mt-0.5">Next trip · Sat Jun 27</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      <div className="container max-w-5xl pb-12 md:pb-16">
        <FAQSection items={faqs} />
      </div>

      {/* FINAL CTA */}
      <section className="container max-w-5xl pb-12 md:pb-20">
        <div className="rounded-3xl border border-primary/20 bg-gradient-to-br from-accent/60 via-card to-card p-8 md:p-12 text-center">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Your next trip starts here.</h2>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
            Search cars across Quebec, book in minutes, and drive away with confidence.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="rounded-full">
              <Link to="/explore">Browse cars</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full">
              <Link to="/how-it-works">How it works</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
