import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CarListing {
  id: string;
  host_id: string;
  status: string;
  title: string;
  make: string;
  model: string;
  year: number;
  trim: string | null;
  description: string | null;
  body_type: string | null;
  seats: number;
  doors: number;
  fuel_type: string;
  consumption_l_per_100km: number | null;
  transmission: string;
  features: { safety: string[]; connectivity: string[] };
  rules: {
    no_smoking: boolean;
    keep_tidy: boolean;
    refuel: boolean;
    no_offroad: boolean;
    smoking_fee_cents: number;
    tidy_fee_cents: number;
    telematics_disclosure: string;
  };
  base_daily_price_cents: number;
  currency: string;
  included_km_per_day: number;
  extra_km_price_cents: number;
  location_label: string | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
  photos: { id: string; url: string; sort_order: number }[];
  extras: {
    id: string;
    name: string;
    description: string | null;
    price_cents: number;
    pricing_type: string;
    is_active: boolean;
  }[];
  cancellation_policy: { name: string; summary: string } | null;
  reviews: {
    id: string;
    rating_overall: number;
    rating_cleanliness: number | null;
    rating_maintenance: number | null;
    rating_communication: number | null;
    rating_convenience: number | null;
    rating_accuracy: number | null;
    comment: string | null;
    created_at: string;
    reviewer: { display_name: string | null; avatar_url: string | null } | null;
  }[];
  host: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    is_all_star: boolean;
    rating_avg: number | null;
    trips_count: number;
    created_at: string;
  } | null;
  rating_avg: number | null;
  rating_count: number;
  trips_count: number;
  sub_ratings: {
    cleanliness: number | null;
    maintenance: number | null;
    communication: number | null;
    convenience: number | null;
    accuracy: number | null;
  };
}

async function fetchCarListing(carId: string): Promise<CarListing> {
  const [carRes, photosRes, extrasRes, policyRes, reviewsRes] = await Promise.all([
    supabase.from("cars").select("*").eq("id", carId).single(),
    supabase.from("car_photos").select("*").eq("car_id", carId).order("sort_order"),
    supabase.from("car_extras").select("*").eq("car_id", carId).eq("is_active", true),
    supabase
      .from("car_policies")
      .select("cancellation_policy_id, cancellation_policies(name, summary)")
      .eq("car_id", carId)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("reviews")
      .select("id, rating_overall, rating_cleanliness, rating_maintenance, rating_communication, rating_convenience, rating_accuracy, comment, created_at, reviewer_id")
      .eq("car_id", carId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  if (carRes.error) throw carRes.error;
  const car = carRes.data;

  // Fetch host profile
  const hostRes = await supabase
    .from("profiles_public" as any)
    .select("id, display_name, avatar_url, is_all_star, rating_avg, trips_count, created_at")
    .eq("id", car.host_id)
    .single();

  // Fetch reviewer profiles
  const reviews = reviewsRes.data || [];
  const reviewerIds = [...new Set(reviews.map((r) => r.reviewer_id))];
  let reviewerMap: Record<string, { display_name: string | null; avatar_url: string | null }> = {};
  if (reviewerIds.length > 0) {
    const profilesRes = await supabase
      .from("profiles_public" as any)
      .select("id, display_name, avatar_url")
      .in("id", reviewerIds);
    ((profilesRes.data as any[]) || []).forEach((p: any) => {
      reviewerMap[p.id] = { display_name: p.display_name, avatar_url: p.avatar_url };
    });
  }

  // Compute rating averages
  const ratingCount = reviews.length;
  const ratingAvg =
    ratingCount > 0
      ? reviews.reduce((s, r) => s + Number(r.rating_overall), 0) / ratingCount
      : null;

  const avgField = (field: keyof typeof reviews[0]) => {
    const vals = reviews.map((r) => r[field]).filter((v) => v != null) as number[];
    return vals.length > 0 ? vals.reduce((s, v) => s + Number(v), 0) / vals.length : null;
  };

  const cp = policyRes.data as any;

  return {
    ...car,
    features: (car.features as any) || { safety: [], connectivity: [] },
    rules: (car.rules as any) || {},
    photos: photosRes.data || [],
    extras: extrasRes.data || [],
    cancellation_policy: cp?.cancellation_policies
      ? { name: cp.cancellation_policies.name, summary: cp.cancellation_policies.summary }
      : null,
    reviews: reviews.map((r) => ({
      ...r,
      reviewer: reviewerMap[r.reviewer_id] || null,
    })),
    host: hostRes.data
      ? (() => {
          const h = hostRes.data as any;
          return {
            ...h,
            is_all_star: h.is_all_star ?? false,
            rating_avg: h.rating_avg ? Number(h.rating_avg) : null,
            trips_count: h.trips_count ?? 0,
          };
        })()
      : null,
    rating_avg: ratingAvg ? Math.round(ratingAvg * 10) / 10 : null,
    rating_count: ratingCount,
    trips_count: 0,
    sub_ratings: {
      cleanliness: avgField("rating_cleanliness") as number | null,
      maintenance: avgField("rating_maintenance") as number | null,
      communication: avgField("rating_communication") as number | null,
      convenience: avgField("rating_convenience") as number | null,
      accuracy: avgField("rating_accuracy") as number | null,
    },
  };
}

export function useCarListing(carId: string | undefined) {
  return useQuery({
    queryKey: ["car-listing", carId],
    queryFn: () => fetchCarListing(carId!),
    enabled: !!carId,
  });
}
