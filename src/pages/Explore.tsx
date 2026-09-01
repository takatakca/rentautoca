import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { CarCardGridSkeleton } from "@/components/ui/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { Search, CalendarDays, Car, SlidersHorizontal } from "lucide-react";
import { format, differenceInCalendarDays } from "date-fns";
import { cn } from "@/lib/utils";
import { VehicleCard, PublicVehicle } from "@/components/vehicle/VehicleCard";
import { FilterPanel } from "@/components/explore/FilterPanel";
import {
  EMPTY_FILTERS,
  ExploreFilters,
  SORT_LABELS,
  SortKey,
  activeFilterCount,
  applyFilters,
  sortCars,
  VEHICLE_TYPES,
  VehicleType,
} from "@/components/explore/filter-state";

type ExploreCar = PublicVehicle & { transmission?: string | null };

export default function Explore() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [locationQuery, setLocationQuery] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [datesOpen, setDatesOpen] = useState(false);
  const [sort, setSort] = useState<SortKey>("recommended");
  const [filters, setFilters] = useState<ExploreFilters>(EMPTY_FILTERS);
  const [draftFilters, setDraftFilters] = useState<ExploreFilters>(EMPTY_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);

  /* Hydrate intent from the URL so homepage/voice search carries over intact. */
  useEffect(() => {
    const p = searchParams;
    const loc = p.get("location");
    if (loc) setLocationQuery(loc);
    const s = p.get("start");
    const e = p.get("end");
    if (s) { const d = new Date(s); if (!isNaN(d.getTime())) setStartDate(d); }
    if (e) { const d = new Date(e); if (!isNaN(d.getTime())) setEndDate(d); }

    const cat = p.get("category");
    const next: ExploreFilters = { ...EMPTY_FILTERS };
    if (cat && (VEHICLE_TYPES as readonly string[]).includes(cat)) next.types = [cat as VehicleType];
    if (cat === "Airports" || p.get("airport") === "1") next.airport = true;
    if (cat === "Monthly" || p.get("monthly") === "1") next.monthly = true;
    if (cat === "Electric" || p.get("electric") === "1") next.fuel = "electric";
    if (p.get("instant") === "1") next.instant = true;
    const maxPrice = Number(p.get("maxPrice"));
    if (Number.isFinite(maxPrice) && maxPrice > 0) next.maxPrice = maxPrice;
    const seats = Number(p.get("seats"));
    if (Number.isFinite(seats) && seats > 0) next.seats = seats;
    setFilters(next);
    setDraftFilters(next);

    const sortParam = p.get("sort") as SortKey | null;
    if (sortParam && sortParam in SORT_LABELS) setSort(sortParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tripDays = startDate && endDate ? Math.max(1, differenceInCalendarDays(endDate, startDate)) : null;

  const { data: cars, isLoading, isError, refetch } = useQuery({
    queryKey: ["explore-cars", locationQuery, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async (): Promise<ExploreCar[]> => {
      let q = supabase
        .from("cars")
        .select(
          "id, make, model, year, base_daily_price_cents, location_label, body_type, transmission, fuel_type, seats, airport_pickup_enabled, monthly_enabled, instant_book",
        )
        .eq("status", "active")
        .limit(60);

      if (locationQuery.trim()) {
        const term = `%${locationQuery.trim()}%`;
        q = q.or(`location_label.ilike.${term},make.ilike.${term},model.ilike.${term},title.ilike.${term}`);
      }

      const { data: carsData, error } = await q;
      if (error) throw error;
      if (!carsData?.length) return [];

      const carIds = carsData.map((c) => c.id);
      const [photosRes, reviewsRes] = await Promise.all([
        supabase.from("car_photos").select("car_id, url").in("car_id", carIds).order("sort_order"),
        supabase.from("reviews").select("car_id, rating_overall").in("car_id", carIds),
      ]);

      const photoMap: Record<string, string> = {};
      (photosRes.data || []).forEach((p) => {
        if (!photoMap[p.car_id]) photoMap[p.car_id] = p.url;
      });

      const agg: Record<string, { sum: number; n: number }> = {};
      (reviewsRes.data || []).forEach((r) => {
        agg[r.car_id] ||= { sum: 0, n: 0 };
        agg[r.car_id].sum += Number(r.rating_overall);
        agg[r.car_id].n += 1;
      });

      const unavailable = new Set<string>();
      if (startDate && endDate) {
        const { data: blocks } = await supabase
          .from("availability_blocks")
          .select("car_id")
          .in("car_id", carIds)
          .lt("start_at", endDate.toISOString())
          .gt("end_at", startDate.toISOString());
        (blocks || []).forEach((b) => unavailable.add(b.car_id));
      }

      return carsData
        .filter((c) => !unavailable.has(c.id))
        .map((car) => ({
          ...car,
          photo_url: photoMap[car.id] || null,
          rating: agg[car.id] ? Math.round((agg[car.id].sum / agg[car.id].n) * 10) / 10 : null,
          trips: agg[car.id]?.n || 0,
        }));
    },
  });

  const results = useMemo(() => sortCars(applyFilters(cars || [], filters), sort), [cars, filters, sort]);

  const syncUrl = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k)));
    setSearchParams(p, { replace: true });
  };

  const resetAll = () => {
    setLocationQuery("");
    setStartDate(undefined);
    setEndDate(undefined);
    setFilters(EMPTY_FILTERS);
    setDraftFilters(EMPTY_FILTERS);
    setSort("recommended");
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  const filterCount = activeFilterCount(filters);
  const dateLabel =
    startDate && endDate
      ? `${format(startDate, "MMM d")} – ${format(endDate, "MMM d")}`
      : startDate
        ? `${format(startDate, "MMM d")} – Return`
        : "Any dates";

  const headline = locationQuery.trim() ? `Cars in ${locationQuery.trim()}` : "Cars available now";
  const subline = [
    startDate && endDate ? `${format(startDate, "MMM d")}–${format(endDate, "MMM d")}` : null,
    isLoading ? null : `${results.length} available`,
  ]
    .filter(Boolean)
    .join(" · ");

  const filterButton = (
    <Sheet
      open={sheetOpen}
      onOpenChange={(o) => {
        setSheetOpen(o);
        if (o) setDraftFilters(filters);
      }}
    >
      <SheetTrigger asChild>
        <Button variant="outline" className="h-10 gap-2">
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          Filters
          {filterCount > 0 && (
            <span className="ml-0.5 rounded-full bg-foreground px-1.5 text-xs text-background">{filterCount}</span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border px-5 py-4 text-left">
          <SheetTitle>Filters</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <FilterPanel value={draftFilters} onChange={setDraftFilters} />
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Button variant="ghost" onClick={() => setDraftFilters(EMPTY_FILTERS)}>
            Clear all
          </Button>
          <Button
            className="flex-1"
            onClick={() => {
              setFilters(draftFilters);
              setSheetOpen(false);
            }}
          >
            Show {sortCars(applyFilters(cars || [], draftFilters), sort).length} cars
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );

  return (
    <div className="flex min-h-dvh flex-col pb-24 md:pb-0">
      {/* Compact sticky search header */}
      <div className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="container flex flex-col gap-3 py-3 md:flex-row md:items-center">
          <div className="relative flex-1 md:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              placeholder="City, make or model"
              aria-label="Search by city, make or model"
              className="h-10 pl-9"
              value={locationQuery}
              onChange={(e) => {
                setLocationQuery(e.target.value);
                syncUrl({ location: e.target.value || null });
              }}
            />
          </div>

          <Popover open={datesOpen} onOpenChange={setDatesOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-10 justify-start gap-2 md:w-56">
                <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{dateLabel}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={{ from: startDate, to: endDate }}
                onSelect={(range) => {
                  setStartDate(range?.from);
                  setEndDate(range?.to);
                  syncUrl({
                    start: range?.from ? range.from.toISOString() : null,
                    end: range?.to ? range.to.toISOString() : null,
                  });
                  if (range?.from && range?.to) setDatesOpen(false);
                }}
                numberOfMonths={1}
                disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>

          <div className="flex items-center gap-2 md:ml-auto">
            {filterButton}
            <Select
              value={sort}
              onValueChange={(v) => {
                setSort(v as SortKey);
                syncUrl({ sort: v === "recommended" ? null : v });
              }}
            >
              <SelectTrigger className="h-10 w-full md:w-48" aria-label="Sort results">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {Object.entries(SORT_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="container py-6">
        <header className="mb-5">
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">{headline}</h1>
          {subline && <p className="mt-0.5 text-sm text-muted-foreground">{subline}</p>}
        </header>

        {isLoading ? (
          <CarCardGridSkeleton count={6} />
        ) : isError ? (
          <EmptyState
            icon={Car}
            title="We couldn't load vehicles"
            description="Something went wrong on our side. Try again in a moment."
            action={{ label: "Retry", onClick: () => refetch() }}
          />
        ) : results.length === 0 ? (
          <EmptyState
            icon={Car}
            title="No cars match your search"
            description="Try a different city, widen your dates, or clear filters to see more options."
            action={{ label: "Clear search", onClick: resetAll }}
          />
        ) : (
          <div className="grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((car, i) => (
              <VehicleCard key={car.id} car={car} tripDays={tripDays} eager={i < 3} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
