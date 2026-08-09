import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export interface CompareVehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  category?: string | null;
  seats?: number | null;
  fuel_type?: string | null;
  transmission?: string | null;
  base_daily_price_cents: number;
  included_km_per_day?: number | null;
  location_label?: string | null;
}

interface CompareCtx {
  items: CompareVehicle[];
  has: (id: string) => boolean;
  toggle: (v: CompareVehicle) => void;
  clear: () => void;
}

const Ctx = createContext<CompareCtx | null>(null);

export function CompareProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CompareVehicle[]>([]);

  const value = useMemo<CompareCtx>(
    () => ({
      items,
      has: (id) => items.some((i) => i.id === id),
      toggle: (v) =>
        setItems((prev) =>
          prev.some((i) => i.id === v.id)
            ? prev.filter((i) => i.id !== v.id)
            : prev.length >= 4
              ? prev
              : [...prev, v],
        ),
      clear: () => setItems([]),
    }),
    [items],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCompare(): CompareCtx {
  return (
    useContext(Ctx) ?? {
      items: [],
      has: () => false,
      toggle: () => undefined,
      clear: () => undefined,
    }
  );
}
