import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useFavorite(carId: string | undefined) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || !carId) {
      setIsFavorite(false);
      return;
    }
    let cancelled = false;
    supabase
      .from("favorites")
      .select("id")
      .eq("user_id", user.id)
      .eq("car_id", carId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setIsFavorite(!!data);
      });
    return () => {
      cancelled = true;
    };
  }, [user, carId]);

  const toggle = useCallback(async () => {
    if (!carId) return;
    if (!user) {
      toast("Sign in to save favorites");
      navigate("/login");
      return;
    }
    setLoading(true);
    // Optimistic
    const next = !isFavorite;
    setIsFavorite(next);
    try {
      if (next) {
        const { error } = await supabase
          .from("favorites")
          .insert({ user_id: user.id, car_id: carId });
        if (error && !error.message.includes("duplicate")) throw error;
      } else {
        const { error } = await supabase
          .from("favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("car_id", carId);
        if (error) throw error;
      }
    } catch (e: any) {
      setIsFavorite(!next);
      toast.error(e.message ?? "Could not update favorite");
    } finally {
      setLoading(false);
    }
  }, [carId, user, isFavorite, navigate]);

  return { isFavorite, toggle, loading };
}
