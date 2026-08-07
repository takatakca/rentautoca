import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DiscoveryCar {
  id: string;
  make: string;
  model: string;
  year: number;
  base_daily_price_cents: number;
  location_label: string | null;
  body_type: string | null;
  fuel_type: string;
  seats: number;
  airport_pickup_enabled: boolean;
  monthly_enabled: boolean;
  instant_book: boolean;
  category: string;
  included_km_per_day: number;
  lat: number | null;
  lng: number | null;
  created_at: string;
  photo_url: string | null;
  rating: number | null;
  reviews: number;
  available_today: boolean;
  distance_km: number | null;
}

/**
 * Single homepage inventory query. All discovery rails slice this in memory,
 * so the landing page issues a small, fixed number of requests.
 */
export function useDiscoveryInventory(coords?: { lat: number; lng: number } | null) {
  return useQuery({
    queryKey: ["discovery-inventory"],
    staleTime: 60_000,
    queryFn: async (): Promise<DiscoveryCar[]> => {
      const { data: carsData, error } = await supabase
        .from("cars")
        .select(
          "id, make, model, year, base_daily_price_cents, location_label, body_type, fuel_type, seats, airport_pickup_enabled, monthly_enabled, instant_book, category, included_km_per_day, lat, lng, created_at"
        )
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(48);

      if (error) throw error;
      if (!carsData || carsData.length === 0) return [];

      const ids = carsData.map((c) => c.id);
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const [photosRes, reviewsRes, blocksRes] = await Promise.all([
        supabase.from("car_photos").select("car_id, url").in("car_id", ids).order("sort_order"),
        supabase.from("reviews").select("car_id, rating_overall").in("car_id", ids),
        supabase
          .from("availability_blocks")
          .select("car_id")
          .in("car_id", ids)
          .lt("start_at", tomorrow.toISOString())
          .gt("end_at", now.toISOString()),
      ]);

      const photoMap: Record<string, string> = {};
      (photosRes.data || []).forEach((p) => {
        if (!photoMap[p.car_id]) photoMap[p.car_id] = p.url;
      });

      const ratings: Record<string, { sum: number; count: number }> = {};
      (reviewsRes.data || []).forEach((r) => {
        ratings[r.car_id] = ratings[r.car_id] || { sum: 0, count: 0 };
        ratings[r.car_id].sum += Number(r.rating_overall);
        ratings[r.car_id].count += 1;
      });

      const blocked = new Set((blocksRes.data || []).map((b) => b.car_id));

      return carsData.map((c) => {
        const r = ratings[c.id];
        return {
          ...c,
          lat: c.lat === null ? null : Number(c.lat),
          lng: c.lng === null ? null : Number(c.lng),
          photo_url: photoMap[c.id] || null,
          rating: r ? Math.round((r.sum / r.count) * 10) / 10 : null,
          reviews: r?.count ?? 0,
          available_today: !blocked.has(c.id),
          distance_km: null,
        } as DiscoveryCar;
      });
    },
  });
}

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}
