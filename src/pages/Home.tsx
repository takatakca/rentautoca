import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { Search, Car, Plane, CalendarDays, MapPin, Shield, DollarSign } from "lucide-react";
import heroImage from "@/assets/hero-car.jpg";

const categories = [
  { icon: Car, label: "All", active: true },
  { icon: Plane, label: "Airports", active: false },
  { icon: CalendarDays, label: "Monthly", active: false },
  { icon: MapPin, label: "Nearby", active: false },
];

const placeholderCars = [
  { id: 1, name: "Toyota Camry 2022", location: "Toronto, ON", price: 65, rating: 4.9, trips: 23 },
  { id: 2, name: "Honda Civic 2023", location: "Vancouver, BC", price: 55, rating: 4.8, trips: 15 },
  { id: 3, name: "Ford F-150 2021", location: "Calgary, AB", price: 95, rating: 5.0, trips: 8 },
  { id: 4, name: "Tesla Model 3 2023", location: "Montreal, QC", price: 110, rating: 4.7, trips: 31 },
];

export default function Home() {
  const { user, hasRole } = useAuth();

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative min-h-[420px] md:min-h-[500px] flex items-center justify-center overflow-hidden">
        <img
          src={heroImage}
          alt="Blue sports car close-up"
          className="absolute inset-0 w-full h-full object-cover"
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/30 to-background" />
        <div className="relative z-10 text-center px-4 py-16 max-w-2xl mx-auto">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-3">
            Skip the rental counter
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-8">
            Rent just about any car, just about anywhere in Canada
          </p>

          {/* Search Bar */}
          <div className="relative max-w-lg mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search anywhere"
              className="h-14 pl-12 pr-16 text-base rounded-full bg-card/90 backdrop-blur border-border/50 focus-visible:ring-primary"
              readOnly
              onClick={() => (window.location.href = "/explore")}
            />
            <Button
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full"
              asChild
            >
              <Link to="/explore">
                <Search className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Category Tabs */}
      <section className="border-b border-border/50">
        <div className="container">
          <div className="flex items-center gap-6 overflow-x-auto py-4 scrollbar-hide">
            {categories.map((cat) => (
              <button
                key={cat.label}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  cat.active
                    ? "bg-card text-foreground border border-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <cat.icon className="h-4 w-4" />
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Cars */}
      <section className="py-10 md:py-14">
        <div className="container">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl md:text-2xl font-bold">Popular cars near you</h2>
            <Link to="/explore" className="text-sm text-primary hover:underline">
              See all →
            </Link>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {placeholderCars.map((car) => (
              <Link
                key={car.id}
                to="/explore"
                className="group rounded-xl overflow-hidden cursor-pointer"
              >
                <div className="aspect-[4/3] bg-muted rounded-xl overflow-hidden mb-3">
                  <div className="w-full h-full bg-gradient-to-br from-muted to-secondary flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                    <Car className="h-10 w-10 text-muted-foreground/40" />
                  </div>
                </div>
                <h3 className="font-semibold text-sm md:text-base">{car.name}</h3>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                  <span className="text-primary font-medium">{car.rating} ★</span>
                  <span>{car.trips} trips</span>
                </div>
                <p className="mt-1 text-sm font-semibold">
                  ${car.price}{" "}
                  <span className="font-normal text-muted-foreground">CAD/day</span>
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Value Props */}
      <section className="py-14 md:py-20 border-t border-border/50">
        <div className="container">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">
            Why Rentauto?
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center px-4">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Car className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Unique selection</h3>
              <p className="text-sm text-muted-foreground">
                From economy to luxury, find the perfect car from local Canadian hosts.
              </p>
            </div>
            <div className="text-center px-4">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Shield className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Protected trips</h3>
              <p className="text-sm text-muted-foreground">
                Every trip includes insurance and 24/7 roadside assistance.
              </p>
            </div>
            <div className="text-center px-4">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <DollarSign className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Earn as a host</h3>
              <p className="text-sm text-muted-foreground">
                List your car and earn money when you're not using it.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Become a Host CTA */}
      {(!user || !hasRole("host")) && (
        <section className="py-14 md:py-20 bg-card">
          <div className="container">
            <div className="flex flex-col md:flex-row items-center gap-8 max-w-4xl mx-auto">
              <div className="flex-1">
                <h2 className="text-2xl md:text-3xl font-bold mb-3">Become a host</h2>
                <p className="text-muted-foreground mb-6">
                  Join thousands of hosts building businesses and earning meaningful income on Rentauto.
                </p>
                <Button size="lg" asChild>
                  <Link to={user ? "/become-host" : "/signup"}>
                    {user ? "Start hosting" : "Get started"}
                  </Link>
                </Button>
              </div>
              <div className="w-full md:w-80 aspect-[4/3] rounded-xl bg-gradient-to-br from-primary/20 to-accent flex items-center justify-center">
                <Car className="h-16 w-16 text-primary/60" />
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
