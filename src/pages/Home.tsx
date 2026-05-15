import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, Car, Plane, CalendarDays, MapPin, Navigation, Building2, Heart } from "lucide-react";
import { useState } from "react";

const categories = [
  { icon: Car, label: "All" },
  { icon: Plane, label: "Airports" },
  { icon: CalendarDays, label: "Monthly" },
  { icon: MapPin, label: "Nearby" },
  { icon: Navigation, label: "Delivered" },
  { icon: Building2, label: "Cities" },
];

export default function Home() {
  const { user, hasRole } = useAuth();
  const [activeCategory, setActiveCategory] = useState("All");

  // Fetch real active listings from DB
  const { data: cars } = useQuery({
    queryKey: ["home-listings"],
    queryFn: async () => {
      const { data: carsData } = await supabase
        .from("cars")
        .select("id, make, model, year, base_daily_price_cents, location_label, body_type, status")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(12);

      if (!carsData || carsData.length === 0) return [];

      // Fetch first photo for each car
      const carIds = carsData.map((c) => c.id);
      const { data: photos } = await supabase
        .from("car_photos")
        .select("car_id, url")
        .in("car_id", carIds)
        .order("sort_order")
        .limit(carIds.length);

      const photoMap: Record<string, string> = {};
      (photos || []).forEach((p) => {
        if (!photoMap[p.car_id]) photoMap[p.car_id] = p.url;
      });

      // Fetch review counts
      const { data: reviews } = await supabase
        .from("reviews")
        .select("car_id, rating_overall")
        .in("car_id", carIds);

      const ratingsMap: Record<string, { avg: number; count: number }> = {};
      (reviews || []).forEach((r) => {
        if (!ratingsMap[r.car_id]) ratingsMap[r.car_id] = { avg: 0, count: 0 };
        ratingsMap[r.car_id].count++;
        ratingsMap[r.car_id].avg += Number(r.rating_overall);
      });
      Object.values(ratingsMap).forEach((r) => {
        r.avg = Math.round((r.avg / r.count) * 10) / 10;
      });

      return carsData.map((car) => ({
        ...car,
        photo_url: photoMap[car.id] || null,
        rating: ratingsMap[car.id]?.avg || null,
        trips: ratingsMap[car.id]?.count || 0,
      }));
    },
  });

  // Placeholder cars when DB is empty
  const placeholderCars = [
    { id: "p1", make: "Toyota", model: "Camry", year: 2022, location_label: "Toronto, ON", base_daily_price_cents: 6500, rating: 4.9, trips: 23, photo_url: null, body_type: "Sedan" },
    { id: "p2", make: "Honda", model: "Civic", year: 2023, location_label: "Vancouver, BC", base_daily_price_cents: 5500, rating: 4.8, trips: 15, photo_url: null, body_type: "Sedan" },
    { id: "p3", make: "Ford", model: "F-150", year: 2021, location_label: "Calgary, AB", base_daily_price_cents: 9500, rating: 5.0, trips: 8, photo_url: null, body_type: "Truck" },
    { id: "p4", make: "Tesla", model: "Model 3", year: 2023, location_label: "Montreal, QC", base_daily_price_cents: 11000, rating: 4.7, trips: 31, photo_url: null, body_type: "Sedan" },
    { id: "p5", make: "BMW", model: "X4 M40i", year: 2024, location_label: "Montreal, QC", base_daily_price_cents: 18900, rating: 5.0, trips: 12, photo_url: null, body_type: "SUV" },
    { id: "p6", make: "Mercedes-Benz", model: "C300", year: 2022, location_label: "Montreal, QC", base_daily_price_cents: 15500, rating: 4.9, trips: 18, photo_url: null, body_type: "Sedan" },
  ];

  const displayCars = cars && cars.length > 0 ? cars : placeholderCars;

  // Group by body_type for category sections
  const suvCars = displayCars.filter((c) => c.body_type?.toLowerCase() === "suv");
  const sedanCars = displayCars.filter((c) => c.body_type?.toLowerCase() === "sedan" || !c.body_type);
  const otherCars = displayCars.filter((c) => c.body_type && !["suv", "sedan"].includes(c.body_type.toLowerCase()));

  const CarCard = ({ car }: { car: (typeof displayCars)[0] }) => (
    <Link
      to={car.id.startsWith("p") ? "/explore" : `/cars/${car.id}`}
      className="group block"
    >
      <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-muted mb-2">
        {car.photo_url ? (
          <img
            src={car.photo_url}
            alt={`${car.make} ${car.model}`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-secondary to-muted flex items-center justify-center">
            <Car className="h-10 w-10 text-muted-foreground/30" />
          </div>
        )}
        <button
          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-background/60 backdrop-blur-sm flex items-center justify-center"
          onClick={(e) => e.preventDefault()}
          aria-label="Add to favorites"
        >
          <Heart className="h-4 w-4 text-foreground" />
        </button>
      </div>
      <h3 className="font-bold text-sm leading-tight">
        {car.make} {car.model} {car.year}
      </h3>
      {car.rating ? (
        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
          <span className="text-primary font-semibold">{car.rating} ★</span>
          <span>{car.trips} {car.trips === 1 ? "trip" : "trips"}</span>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground mt-0.5">New listing</p>
      )}
      <p className="mt-1 text-sm font-semibold">
        ${(car.base_daily_price_cents / 100).toFixed(0)}
        <span className="font-normal text-muted-foreground">/day</span>
      </p>
    </Link>
  );

  return (
    <div className="flex flex-col pb-20 md:pb-0">
      <h1 className="sr-only">Rent the perfect car in Montreal and across Canada</h1>
      {/* Search Bar */}
      <div className="px-4 pt-4 pb-2">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <Input
            placeholder="Search anywhere"
            aria-label="Search cars"
            className="h-14 pl-12 pr-16 text-base rounded-full bg-card border-border focus-visible:ring-primary"
            readOnly
            onClick={() => (window.location.href = "/explore")}
          />
          <Button
            size="icon"
            aria-label="Search cars"
            className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full"
            asChild
          >
            <Link to="/explore">
              <Search className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Category Tabs - scrollable */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
          {categories.map((cat) => (
            <button
              key={cat.label}
              onClick={() => setActiveCategory(cat.label)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors shrink-0 ${
                activeCategory === cat.label
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

      {/* Car Sections */}
      <div className="px-4 space-y-8 pb-8">
        {/* All / Sedans */}
        {sedanCars.length > 0 && (
          <section>
            <h2 className="text-lg font-bold mb-3">Popular cars in Montreal</h2>
            <div className="grid grid-cols-2 gap-4">
              {sedanCars.map((car) => (
                <CarCard key={car.id} car={car} />
              ))}
            </div>
          </section>
        )}

        {/* SUVs */}
        {suvCars.length > 0 && (
          <section>
            <h2 className="text-lg font-bold mb-3">Monthly SUV rentals in Montreal</h2>
            <div className="grid grid-cols-2 gap-4">
              {suvCars.map((car) => (
                <CarCard key={car.id} car={car} />
              ))}
            </div>
          </section>
        )}

        {/* Other */}
        {otherCars.length > 0 && (
          <section>
            <h2 className="text-lg font-bold mb-3">More vehicles</h2>
            <div className="grid grid-cols-2 gap-4">
              {otherCars.map((car) => (
                <CarCard key={car.id} car={car} />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Become a Host CTA - only on desktop or if no listings */}
      {(!user || !hasRole("host")) && (
        <section className="px-4 py-10 bg-card mx-4 rounded-xl mb-8">
          <h2 className="text-xl font-bold mb-2">Become a host</h2>
          <p className="text-muted-foreground text-sm mb-4">
            List your car and earn meaningful income on Rentauto.
          </p>
          <Button asChild>
            <Link to={user ? "/become-host" : "/signup"}>
              {user ? "Start hosting" : "Get started"}
            </Link>
          </Button>
        </section>
      )}
    </div>
  );
}
