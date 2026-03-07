import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search, MapPin, CalendarDays, Car, Heart, Star,
  Plane, Navigation, Building2, SlidersHorizontal
} from "lucide-react";
import { format, differenceInDays } from "date-fns";

const categories = [
  { icon: Car, label: "All" },
  { icon: Plane, label: "Airports" },
  { icon: CalendarDays, label: "Monthly" },
  { icon: MapPin, label: "Nearby" },
  { icon: Navigation, label: "Delivered" },
  { icon: Building2, label: "Cities" },
];

export default function Explore() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [locationQuery, setLocationQuery] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);

  const tripDays = startDate && endDate ? Math.max(1, differenceInDays(endDate, startDate)) : null;

  // Fetch cars from DB
  const { data: cars, isLoading } = useQuery({
    queryKey: ["explore-cars", locationQuery, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      let q = supabase
        .from("cars")
        .select("id, make, model, year, base_daily_price_cents, location_label, body_type, status, transmission, fuel_type, seats")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(24);

      if (locationQuery.trim()) {
        q = q.ilike("location_label", `%${locationQuery.trim()}%`);
      }

      const { data: carsData } = await q;
      if (!carsData || carsData.length === 0) return [];

      const carIds = carsData.map((c) => c.id);

      // Fetch first photo per car + reviews in parallel
      const [photosRes, reviewsRes] = await Promise.all([
        supabase
          .from("car_photos")
          .select("car_id, url")
          .in("car_id", carIds)
          .order("sort_order"),
        supabase
          .from("reviews")
          .select("car_id, rating_overall")
          .in("car_id", carIds),
      ]);

      const photoMap: Record<string, string> = {};
      (photosRes.data || []).forEach((p) => {
        if (!photoMap[p.car_id]) photoMap[p.car_id] = p.url;
      });

      const ratingsMap: Record<string, { avg: number; count: number }> = {};
      (reviewsRes.data || []).forEach((r) => {
        if (!ratingsMap[r.car_id]) ratingsMap[r.car_id] = { avg: 0, count: 0 };
        ratingsMap[r.car_id].count++;
        ratingsMap[r.car_id].avg += Number(r.rating_overall);
      });
      Object.values(ratingsMap).forEach((r) => {
        r.avg = Math.round((r.avg / r.count) * 10) / 10;
      });

      // If dates selected, check availability
      let unavailableIds = new Set<string>();
      if (startDate && endDate) {
        const { data: blocks } = await supabase
          .from("availability_blocks")
          .select("car_id")
          .in("car_id", carIds)
          .lt("start_at", endDate.toISOString())
          .gt("end_at", startDate.toISOString());

        (blocks || []).forEach((b) => unavailableIds.add(b.car_id));
      }

      return carsData
        .filter((c) => !unavailableIds.has(c.id))
        .map((car) => ({
          ...car,
          photo_url: photoMap[car.id] || null,
          rating: ratingsMap[car.id]?.avg || null,
          trips: ratingsMap[car.id]?.count || 0,
        }));
    },
  });

  const filteredCars = useMemo(() => {
    if (!cars) return [];
    if (activeCategory === "All") return cars;
    if (activeCategory === "Monthly") return cars; // same list, UI shows monthly pricing
    return cars;
  }, [cars, activeCategory]);

  return (
    <div className="flex flex-col pb-20 md:pb-0 min-h-screen">
      {/* Search bar */}
      <div className="px-4 pt-4 pb-2 space-y-3">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="City, airport, or address"
            className="h-12 pl-12 rounded-full bg-card border-border"
            value={locationQuery}
            onChange={(e) => setLocationQuery(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          {/* Start date */}
          <Popover open={startOpen} onOpenChange={setStartOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="flex-1 justify-start text-left h-11 rounded-xl">
                <CalendarDays className="h-4 w-4 mr-2 shrink-0" />
                {startDate ? format(startDate, "MMM d") : "Pick-up"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={(d) => { setStartDate(d); setStartOpen(false); }}
                disabled={(d) => d < new Date()}
              />
            </PopoverContent>
          </Popover>

          {/* End date */}
          <Popover open={endOpen} onOpenChange={setEndOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="flex-1 justify-start text-left h-11 rounded-xl">
                <CalendarDays className="h-4 w-4 mr-2 shrink-0" />
                {endDate ? format(endDate, "MMM d") : "Return"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={(d) => { setEndDate(d); setEndOpen(false); }}
                disabled={(d) => d < (startDate || new Date())}
              />
            </PopoverContent>
          </Popover>

          <Button size="icon" className="h-11 w-11 rounded-xl shrink-0">
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Category tabs */}
      <div className="px-4 py-2">
        <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
          {categories.map((cat) => (
            <button
              key={cat.label}
              onClick={() => setActiveCategory(cat.label)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors shrink-0 ${
                activeCategory === cat.label
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground bg-card border border-border"
              }`}
            >
              <cat.icon className="h-4 w-4" />
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Trip info bar */}
      {tripDays && (
        <div className="px-4 py-2">
          <p className="text-sm text-muted-foreground">
            Showing cars available for <span className="font-semibold text-foreground">{tripDays} {tripDays === 1 ? "day" : "days"}</span>
            {locationQuery && <> near <span className="font-semibold text-foreground">{locationQuery}</span></>}
          </p>
        </div>
      )}

      {/* Results */}
      <div className="px-4 pb-8">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 mt-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-[4/3] rounded-xl" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : filteredCars.length === 0 ? (
          <div className="text-center py-16">
            <Car className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="font-bold text-lg mb-1">No cars found</h3>
            <p className="text-muted-foreground text-sm">
              Try adjusting your dates or location.
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-3 mt-1">
              {filteredCars.length} {filteredCars.length === 1 ? "car" : "cars"} available
            </p>
            <div className="grid grid-cols-2 gap-4">
              {filteredCars.map((car) => (
                <Link
                  key={car.id}
                  to={`/cars/${car.id}`}
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
                    >
                      <Heart className="h-4 w-4 text-foreground" />
                    </button>
                  </div>
                  <h3 className="font-bold text-sm leading-tight">
                    {car.make} {car.model} {car.year}
                  </h3>
                  {car.rating ? (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      <Star className="h-3 w-3 fill-primary text-primary" />
                      <span className="font-semibold text-foreground">{car.rating}</span>
                      <span>({car.trips} {car.trips === 1 ? "trip" : "trips"})</span>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-0.5">New listing</p>
                  )}
                  <p className="mt-1 text-sm font-semibold">
                    ${(car.base_daily_price_cents / 100).toFixed(0)}
                    <span className="font-normal text-muted-foreground">/day</span>
                  </p>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
