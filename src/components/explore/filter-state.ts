export type SortKey = "recommended" | "price_asc" | "price_desc" | "rating" | "newest";

export const SORT_LABELS: Record<SortKey, string> = {
  recommended: "Recommended",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
  rating: "Highest rated",
  newest: "Newest",
};

export const VEHICLE_TYPES = ["Economy", "Sedan", "SUV", "Luxury", "Electric", "Family", "7+ seats"] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export interface ExploreFilters {
  minPrice: number | null;
  maxPrice: number | null;
  types: VehicleType[];
  seats: number | null;
  transmission: "automatic" | "manual" | null;
  fuel: "gas" | "hybrid" | "electric" | null;
  airport: boolean;
  monthly: boolean;
  instant: boolean;
  minRating: number | null;
}

export const EMPTY_FILTERS: ExploreFilters = {
  minPrice: null,
  maxPrice: null,
  types: [],
  seats: null,
  transmission: null,
  fuel: null,
  airport: false,
  monthly: false,
  instant: false,
  minRating: null,
};

export function activeFilterCount(f: ExploreFilters) {
  let n = 0;
  if (f.minPrice != null || f.maxPrice != null) n++;
  n += f.types.length;
  if (f.seats) n++;
  if (f.transmission) n++;
  if (f.fuel) n++;
  if (f.airport) n++;
  if (f.monthly) n++;
  if (f.instant) n++;
  if (f.minRating) n++;
  return n;
}

interface Candidate {
  base_daily_price_cents: number;
  seats?: number | null;
  body_type?: string | null;
  transmission?: string | null;
  fuel_type?: string | null;
  airport_pickup_enabled?: boolean | null;
  monthly_enabled?: boolean | null;
  instant_book?: boolean | null;
  rating?: number | null;
}

function matchesType(car: Candidate, type: VehicleType) {
  const body = (car.body_type || "").toLowerCase();
  const fuel = (car.fuel_type || "").toLowerCase();
  const price = car.base_daily_price_cents;
  switch (type) {
    case "Economy":
      return price <= 6000 || /compact|economy|hatch/.test(body);
    case "Sedan":
      return /sedan|coupe|saloon/.test(body);
    case "SUV":
      return /suv|crossover|truck|van/.test(body);
    case "Luxury":
      return price >= 15000 || /luxury|premium|sport/.test(body);
    case "Electric":
      return /electric|ev/.test(fuel);
    case "Family":
      return (car.seats ?? 0) >= 5 || /minivan|van|suv/.test(body);
    case "7+ seats":
      return (car.seats ?? 0) >= 7;
  }
}

export function applyFilters<T extends Candidate>(cars: T[], f: ExploreFilters): T[] {
  return cars.filter((c) => {
    if (f.minPrice != null && c.base_daily_price_cents < f.minPrice * 100) return false;
    if (f.maxPrice != null && c.base_daily_price_cents > f.maxPrice * 100) return false;
    if (f.types.length && !f.types.some((t) => matchesType(c, t))) return false;
    if (f.seats && (c.seats ?? 0) < f.seats) return false;
    if (f.transmission && (c.transmission || "").toLowerCase() !== f.transmission) return false;
    if (f.fuel) {
      const fuel = (c.fuel_type || "").toLowerCase();
      const want = f.fuel === "electric" ? /electric|ev/ : f.fuel === "hybrid" ? /hybrid/ : /gas|petrol|diesel/;
      if (!want.test(fuel)) return false;
    }
    if (f.airport && !c.airport_pickup_enabled) return false;
    if (f.monthly && !c.monthly_enabled) return false;
    if (f.instant && !c.instant_book) return false;
    if (f.minRating && (c.rating ?? 0) < f.minRating) return false;
    return true;
  });
}

export function sortCars<T extends Candidate & { year?: number }>(cars: T[], sort: SortKey): T[] {
  const list = [...cars];
  switch (sort) {
    case "price_asc":
      return list.sort((a, b) => a.base_daily_price_cents - b.base_daily_price_cents);
    case "price_desc":
      return list.sort((a, b) => b.base_daily_price_cents - a.base_daily_price_cents);
    case "rating":
      return list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    case "newest":
      return list.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
    default:
      // Recommended: rated listings first, then value.
      return list.sort(
        (a, b) => (b.rating ?? 0) - (a.rating ?? 0) || a.base_daily_price_cents - b.base_daily_price_cents,
      );
  }
}
