import type { PublicVehicle } from "@/components/vehicle/VehicleCard";

/**
 * Single mapping layer between raw query rows and the canonical public
 * vehicle card contract. Pages must not reinvent this mapping, and nothing
 * private (VIN, plate, documents, host identity) is ever carried through.
 */
export interface RawVehicleRow {
  id: string;
  make: string;
  model: string;
  year: number;
  trim?: string | null;
  base_daily_price_cents: number;
  location_label?: string | null;
  body_type?: string | null;
  category?: string | null;
  seats?: number | null;
  fuel_type?: string | null;
  transmission?: string | null;
  included_km_per_day?: number | null;
  extra_km_price_cents?: number | null;
  airport_pickup_enabled?: boolean | null;
  monthly_enabled?: boolean | null;
  instant_book?: boolean | null;
  available_today?: boolean | null;
  distance_km?: number | null;
  photo_url?: string | null;
  rating?: number | null;
  reviews?: number | null;
  trips?: number | null;
}

export function toPublicVehicle(row: RawVehicleRow): PublicVehicle {
  return {
    id: row.id,
    make: row.make,
    model: row.model,
    year: row.year,
    trim: row.trim ?? null,
    base_daily_price_cents: row.base_daily_price_cents,
    location_label: row.location_label ?? null,
    body_type: row.body_type ?? row.category ?? null,
    seats: row.seats ?? null,
    fuel_type: row.fuel_type ?? null,
    transmission: row.transmission ?? null,
    included_km_per_day: row.included_km_per_day ?? null,
    photo_url: row.photo_url ?? null,
    rating: row.rating ?? null,
    trips: row.trips ?? row.reviews ?? null,
    airport_pickup_enabled: row.airport_pickup_enabled ?? null,
    monthly_enabled: row.monthly_enabled ?? null,
    instant_book: row.instant_book ?? null,
    available_today: row.available_today ?? null,
    distance_km: row.distance_km ?? null,
  };
}

/** Number of billable days between two dates, or null when dates are unknown. */
export function tripDaysBetween(start?: Date | null, end?: Date | null): number | null {
  if (!start || !end) return null;
  const ms = end.getTime() - start.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return Math.max(1, Math.round(ms / 86_400_000));
}

/** Formats a booking reference for display, falling back to a short id. */
export function displayBookingRef(ref?: string | null, id?: string): string {
  if (ref) return ref;
  return id ? `#${id.slice(0, 8).toUpperCase()}` : "—";
}
