import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { CarCardGridSkeleton } from "@/components/ui/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { Heart, X } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { VehicleCard, type PublicVehicle } from "@/components/vehicle/VehicleCard";
import { CompareSheet } from "@/components/vehicle/CompareSheet";
import { toPublicVehicle, tripDaysBetween } from "@/lib/vehicle-presentation";

interface SavedVehicle extends PublicVehicle {
  fav_id: string;
  saved_at: string;
  /** null when no dates are selected — never guessed. */
  available: boolean | null;
}

type SortKey = "recent" | "price" | "rating";

const SORT_LABELS: Record<SortKey, string> = {
  recent: "Recently saved",
  price: "Price: low to high",
  rating: "Top rated",
};

export default function Favorites() {
  const { user, isLoading: authLoading } = useAuth();
  const [params] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<SavedVehicle[]>([]);
  const [sort, setSort] = useState<SortKey>("recent");
  const [selected, setSelected] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);

  const location = params.get("location");
  const startParam = params.get("start");
  const endParam = params.get("end");
  const start = startParam ? new Date(startParam) : null;
  const end = endParam ? new Date(endParam) : null;
  const validStart = start && !isNaN(start.getTime()) ? start : null;
  const validEnd = end && !isNaN(end.getTime()) ? end : null;
  const tripDays = tripDaysBetween(validStart, validEnd);

  const contextLabel = [
    location || null,
    validStart && validEnd ? `${format(validStart, "MMM d")} – ${format(validEnd, "MMM d")}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const { data: favs } = await supabase
        .from("favorites")
        .select("id, car_id, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      const carIds = (favs || []).map((f) => f.car_id);
      if (!carIds.length) {
        if (!cancelled) {
          setItems([]);
          setLoading(false);
        }
        return;
      }

      const [carsRes, photosRes, reviewsRes] = await Promise.all([
        supabase
          .from("cars")
          .select(
            "id, make, model, year, trim, base_daily_price_cents, location_label, body_type, seats, fuel_type, transmission, included_km_per_day, airport_pickup_enabled, monthly_enabled, instant_book",
          )
          .in("id", carIds),
        supabase.from("car_photos").select("car_id, url").in("car_id", carIds).order("sort_order"),
        supabase.from("reviews").select("car_id, rating_overall").in("car_id", carIds),
      ]);

      let blockedIds = new Set<string>();
      if (validStart && validEnd) {
        const { data: blocks } = await supabase
          .from("availability_blocks")
          .select("car_id")
          .in("car_id", carIds)
          .lt("start_at", validEnd.toISOString())
          .gt("end_at", validStart.toISOString());
        blockedIds = new Set((blocks || []).map((b) => b.car_id));
      }

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
      const carsById: Record<string, any> = {};
      (carsRes.data || []).forEach((c) => (carsById[c.id] = c));

      const mapped = (favs || [])
        .map((f) => {
          const c = carsById[f.car_id];
          if (!c) return null;
          const r = agg[f.car_id];
          return {
            ...toPublicVehicle({
              ...c,
              photo_url: photoMap[c.id] || null,
              rating: r ? Math.round((r.sum / r.n) * 10) / 10 : null,
              trips: r?.n ?? null,
            }),
            fav_id: f.id,
            saved_at: f.created_at,
            available: validStart && validEnd ? !blockedIds.has(c.id) : null,
          } as SavedVehicle;
        })
        .filter(Boolean) as SavedVehicle[];

      if (!cancelled) {
        setItems(mapped);
        setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, startParam, endParam]);

  const sorted = useMemo(() => {
    const list = [...items];
    if (sort === "price") list.sort((a, b) => a.base_daily_price_cents - b.base_daily_price_cents);
    else if (sort === "rating") list.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
    else list.sort((a, b) => +new Date(b.saved_at) - +new Date(a.saved_at));
    return list;
  }, [items, sort]);

  const compareItems = sorted.filter((i) => selected.includes(i.id));

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= 3) {
        toast("You can compare up to 3 vehicles");
        return prev;
      }
      return [...prev, id];
    });
  };

  const remove = async (fav: SavedVehicle) => {
    const prev = items;
    setItems(items.filter((i) => i.fav_id !== fav.fav_id));
    setSelected((s) => s.filter((id) => id !== fav.id));
    const { error } = await supabase.from("favorites").delete().eq("id", fav.fav_id);
    if (error) {
      setItems(prev);
      toast.error(error.message);
    }
  };

  if (!user && !authLoading) {
    return (
      <div className="container py-8 max-w-6xl mx-auto pb-24 md:pb-8">
        <h1 className="text-3xl font-bold mb-6">Saved cars</h1>
        <EmptyState
          icon={Heart}
          title="Sign in to see saved cars"
          description="Save vehicles to come back to later."
          action={{ label: "Sign in", href: "/login" }}
        />
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-6xl mx-auto pb-28 md:pb-8">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Saved cars</h1>
          {contextLabel && <p className="mt-1 text-sm text-muted-foreground">{contextLabel}</p>}
        </div>
        {items.length > 0 && (
          <div className="flex items-center gap-2">
            <label htmlFor="fav-sort" className="text-sm text-muted-foreground">
              Sort
            </label>
            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger id="fav-sort" className="w-[11rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {SORT_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {loading ? (
        <CarCardGridSkeleton count={6} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="No saved cars yet"
          description="Tap the heart on any vehicle to save it for later."
          action={{ label: "Browse cars", href: "/explore" }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((v) => (
            <VehicleCard
              key={v.fav_id}
              car={v}
              tripDays={tripDays}
              hideFavorite
              footer={
                <div className="flex items-center justify-between gap-2">
                  <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
                    <Checkbox
                      checked={selected.includes(v.id)}
                      onCheckedChange={() => toggleSelect(v.id)}
                      aria-label={`Compare ${v.make} ${v.model}`}
                    />
                    Compare
                  </label>
                  <div className="flex items-center gap-2">
                    {v.available === false && (
                      <span className="text-xs text-muted-foreground">Unavailable for these dates</span>
                    )}
                    {v.available === true && <span className="text-xs text-primary">Available</span>}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => remove(v)}
                      aria-label={`Remove ${v.make} ${v.model} from saved cars`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              }
            />
          ))}
        </div>
      )}

      {compareItems.length >= 2 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
          <div className="container flex max-w-6xl items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{compareItems.length} selected</p>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
                Clear
              </Button>
              <Button size="sm" onClick={() => setCompareOpen(true)}>
                Compare
              </Button>
            </div>
          </div>
        </div>
      )}

      <CompareSheet
        open={compareOpen}
        onOpenChange={setCompareOpen}
        vehicles={compareItems}
        tripDays={tripDays}
      />
    </div>
  );
}
