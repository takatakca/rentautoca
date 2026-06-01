import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TripListSkeleton } from "@/components/ui/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { Heart, Star, MapPin, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface FavoriteCar {
  fav_id: string;
  car_id: string;
  make: string;
  model: string;
  year: number;
  base_daily_price_cents: number;
  location_label: string | null;
  photo_url: string | null;
  rating: number | null;
}

export default function Favorites() {
  const { user, isLoading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<FavoriteCar[]>([]);

  const load = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: favs } = await supabase
      .from("favorites")
      .select("id, car_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    const carIds = (favs || []).map((f) => f.car_id);
    if (carIds.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }

    const [carsRes, photosRes, reviewsRes] = await Promise.all([
      supabase
        .from("cars")
        .select("id, make, model, year, base_daily_price_cents, location_label")
        .in("id", carIds),
      supabase.from("car_photos").select("car_id, url").in("car_id", carIds).order("sort_order"),
      supabase.from("reviews").select("car_id, rating_overall").in("car_id", carIds),
    ]);

    const photoMap: Record<string, string> = {};
    (photosRes.data || []).forEach((p) => {
      if (!photoMap[p.car_id]) photoMap[p.car_id] = p.url;
    });
    const ratingAgg: Record<string, { sum: number; n: number }> = {};
    (reviewsRes.data || []).forEach((r) => {
      ratingAgg[r.car_id] ||= { sum: 0, n: 0 };
      ratingAgg[r.car_id].sum += Number(r.rating_overall);
      ratingAgg[r.car_id].n += 1;
    });

    const carsById: Record<string, any> = {};
    (carsRes.data || []).forEach((c) => (carsById[c.id] = c));

    setItems(
      (favs || [])
        .map((f) => {
          const c = carsById[f.car_id];
          if (!c) return null;
          const r = ratingAgg[f.car_id];
          return {
            fav_id: f.id,
            car_id: c.id,
            make: c.make,
            model: c.model,
            year: c.year,
            base_daily_price_cents: c.base_daily_price_cents,
            location_label: c.location_label,
            photo_url: photoMap[c.id] || null,
            rating: r ? Math.round((r.sum / r.n) * 10) / 10 : null,
          } as FavoriteCar;
        })
        .filter(Boolean) as FavoriteCar[],
    );
    setLoading(false);
  };

  useEffect(() => {
    if (!authLoading) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  const remove = async (favId: string) => {
    const prev = items;
    setItems(items.filter((i) => i.fav_id !== favId));
    const { error } = await supabase.from("favorites").delete().eq("id", favId);
    if (error) {
      setItems(prev);
      toast.error(error.message);
    }
  };

  if (!user && !authLoading) {
    return (
      <div className="container py-8 max-w-3xl mx-auto pb-24 md:pb-8">
        <h1 className="text-3xl font-bold mb-6">Your Favorites</h1>
        <EmptyState
          icon={Heart}
          title="Sign in to see favorites"
          description="Save vehicles to come back to later."
          action={{ label: "Sign in", href: "/login" }}
        />
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-3xl mx-auto pb-24 md:pb-8">
      <h1 className="text-3xl font-bold mb-6">Your Favorites</h1>

      {loading ? (
        <TripListSkeleton count={3} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="No favorites yet"
          description="Tap the heart on any vehicle to save it for later."
          action={{ label: "Browse cars", href: "/explore" }}
        />
      ) : (
        <div className="space-y-3">
          {items.map((it) => (
            <Card key={it.fav_id} className="hover:border-primary/50 transition-colors">
              <CardContent className="p-4 flex gap-4">
                <Link to={`/cars/${it.car_id}`} className="w-28 h-24 rounded-lg overflow-hidden bg-muted shrink-0">
                  {it.photo_url && <img src={it.photo_url} alt="" className="w-full h-full object-cover" />}
                </Link>
                <div className="flex-1 min-w-0">
                  <Link to={`/cars/${it.car_id}`}>
                    <h3 className="font-semibold truncate">
                      {it.make} {it.model} {it.year}
                    </h3>
                  </Link>
                  {it.location_label && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {it.location_label}
                    </p>
                  )}
                  {it.rating != null && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Star className="h-3 w-3 fill-primary text-primary" /> {it.rating}
                    </p>
                  )}
                  <p className="text-sm font-semibold mt-1">
                    ${(it.base_daily_price_cents / 100).toFixed(0)}
                    <span className="font-normal text-muted-foreground">/day</span>
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => remove(it.fav_id)} aria-label="Remove">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
