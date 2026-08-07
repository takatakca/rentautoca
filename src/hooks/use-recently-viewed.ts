import { useCallback, useEffect, useState } from "react";

const KEY = "rentauto:recently-viewed";
const MAX = 10;

export interface RecentCar {
  id: string;
  make: string;
  model: string;
  year: number;
  price_cents: number;
  photo_url: string | null;
  location_label: string | null;
  viewedAt: number;
}

function read(): RecentCar[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function recordRecentlyViewed(car: Omit<RecentCar, "viewedAt">) {
  try {
    const list = read().filter((c) => c.id !== car.id);
    list.unshift({ ...car, viewedAt: Date.now() });
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* storage unavailable — non-critical */
  }
}

export function useRecentlyViewed() {
  const [items, setItems] = useState<RecentCar[]>([]);

  useEffect(() => {
    setItems(read());
  }, []);

  const clear = useCallback(() => {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* noop */
    }
    setItems([]);
  }, []);

  return { items, clear };
}
