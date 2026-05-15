import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search, MapPin, CalendarDays, Car, Heart, Star,
  Plane, Navigation, Building2, SlidersHorizontal
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { useFavorite } from "@/hooks/use-favorite";
import { cn } from "@/lib/utils";

const categories = [
  { icon: Car, label: "All" },
  { icon: Plane, label: "Airports" },
  { icon: CalendarDays, label: "Monthly" },
  { icon: MapPin, label: "Nearby" },
  { icon: Navigation, label: "Delivered" },
  { icon: Building2, label: "Cities" },
];

type SortKey = "newest" | "price_asc" | "price_desc" | "rating";

export default function Explore() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [locationQuery, setLocationQuery] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [sort, setSort] = useState<SortKey>("newest");

  const tripDays = startDate && endDate ? Math.max(1, differenceInDays(endDate, startDate)) : null;

  const { data: cars, isLoading } = useQuery({
    queryKey: ["explore-cars", locationQuery, startDate?.toISOString(), endDate?.toISOString(), activeCategory],
    queryFn: async () => {
      let q = supabase
        .from("cars")
        .select("id, make, model, year, base_daily_price_cents, location_label, body_type, status, transmission, fuel_type, seats, airport_pickup_enabled, monthly_enabled")
        .eq("status", "active")
        .limit(48);

      if (locationQuery.trim()) {
        const term = `%${locationQuery.trim()}%`;
        q = q.or(`location_label.ilike.${term},make.ilike.${term},model.ilike.${term},title.ilike.${term}`);
      }
      if (activeCategory === "Airports") q = q.eq("airport_pickup_enabled", true);
      if (activeCategory === "Monthly") q = q.eq("monthly_enabled", true);

      const { data: carsData } = await q;
      if (!carsData || carsData.length === 0) return [];

      const carIds = carsData.map((c) => c.id);

      const [photosRes, reviewsRes] = await Promise.all([
        supabase.from("car_photos").select("car_id, url").in("car_id", carIds).order("sort_order"),
        supabase.from("reviews").select("car_id, rating_overall").in("car_id", carIds),
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

      // Availability overlap: a car is unavailable if any block overlaps
      // selectedStart < block.end_at AND selectedEnd > block.start_at
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
    const list = [...(cars || [])];
    switch (sort) {
      case "price_asc": list.sort((a, b) => a.base_daily_price_cents - b.base_daily_price_cents); break;
      case "price_desc": list.sort((a, b) => b.base_daily_price_cents - a.base_daily_price_cents); break;
      case "rating": list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)); break;
      default: break;
    }
    return list;
  }, [cars, sort]);

  const reset = () => {
    setLocationQuery("");
    setStartDate(undefined);
    setEndDate(undefined);
    setActiveCategory("All");
    setSort("newest");
  };

  return (
    <div className="flex flex-col pb-20 md:pb-0 min-h-screen">
      <div className="px-4 pt-4 pb-2 space-y-3">
        <h1 className="sr-only">Explore cars available to rent</h1>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <Input
            placeholder="City, make, model"
            aria-label="Search by city, make, or model"
            className="h-12 pl-12 rounded-full bg-card border-border"
            value={locationQuery}
            onChange={(e) => setLocationQuery(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
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
                onSelect={(d) => {
                  setStartDate(d);
                  if (d && endDate && endDate <= d) setEndDate(undefined);
                  setStartOpen(false);
                }}
                disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>

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
                disabled={(d) => d < (startDate || new Date(new Date().setHours(0, 0, 0, 0)))}
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>

          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="h-11 w-11 rounded-xl shrink-0 px-0 justify-center" aria-label="Sort">
              <SlidersHorizontal className="h-4 w-4" />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="price_asc">Price: low to high</SelectItem>
              <SelectItem value="price_desc">Price: high to low</SelectItem>
              <SelectItem value="rating">Highest rated</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

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

      {tripDays && (
        <div className="px-4 py-2">
          <p className="text-sm text-muted-foreground">
            Showing cars available for{" "}
            <span className="font-semibold text-foreground">
              {tripDays} {tripDays === 1 ? "day" : "days"}
            </span>
            {locationQuery && (
              <>
                {" "}near <span className="font-semibold text-foreground">{locationQuery}</span>
              </>
            )}
          </p>
        </div>
      )}

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
            <p className="text-muted-foreground text-sm mb-4">
              Try adjusting your dates, filters, or location.
            </p>
            <Button variant="outline" onClick={reset}>Reset filters</Button>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-3 mt-1">
              {filteredCars.length} {filteredCars.length === 1 ? "car" : "cars"} available
            </p>
            <div className="grid grid-cols-2 gap-4">
              {filteredCars.map((car) => (
                <CarCard key={car.id} car={car} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function CarCard({ car }: { car: any }) {
  const { isFavorite, toggle } = useFavorite(car.id);
  return (
    <Link to={`/cars/${car.id}`} className="group block">
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
          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-background/70 backdrop-blur-sm flex items-center justify-center"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(); }}
          aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
        >
          <Heart className={cn("h-4 w-4", isFavorite ? "fill-primary text-primary" : "text-foreground")} />
        </button>
        <div className="absolute bottom-2 left-2 flex gap-1">
          {car.airport_pickup_enabled && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-background/80 backdrop-blur-sm flex items-center gap-1">
              <Plane className="h-3 w-3" /> Airport
            </span>
          )}
          {car.monthly_enabled && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-background/80 backdrop-blur-sm flex items-center gap-1">
              <CalendarDays className="h-3 w-3" /> Monthly
            </span>
          )}
        </div>
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
  );
}
