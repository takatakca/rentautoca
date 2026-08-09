import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Cover photo lookup for a set of vehicles. Used by concierge result cards so
 * assistant answers render real vehicle photography instead of text lists.
 */
export function useCarPhotos(carIds: string[]) {
  const key = [...carIds].sort().join(",");
  return useQuery({
    queryKey: ["car-photos", key],
    enabled: carIds.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase
        .from("car_photos")
        .select("car_id,url")
        .in("car_id", carIds)
        .order("sort_order");
      if (error) throw error;
      const map: Record<string, string> = {};
      (data ?? []).forEach((p) => {
        if (!map[p.car_id]) map[p.car_id] = p.url;
      });
      return map;
    },
  });
}
