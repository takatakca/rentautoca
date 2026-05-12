import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TripQuote {
  days: number;
  base_price: number;
  extras_total: number;
  extras_breakdown: { name: string; price_cents: number }[];
  protection_total: number;
  protection_snapshot: {
    id: string;
    name: string;
    tier: string;
    price_per_day_cents: number;
    deductible_cents: number;
    total_cents: number;
  } | null;
  discounts: number;
  discount_percent: number;
  taxes: number;
  total_before_tax: number;
  total_after_tax: number;
  included_km_total: number;
  extra_km_price: number;
  currency: string;
  cancellation_policy_snapshot: { name: string; summary: string; rules?: unknown } | null;
}

interface QuoteParams {
  carId: string;
  startAt: string;
  endAt: string;
  selectedExtras?: string[];
  protectionPlanId?: string | null;
}

async function fetchQuote(params: QuoteParams): Promise<TripQuote> {
  const { data, error } = await supabase.functions.invoke("quote-trip", {
    body: {
      carId: params.carId,
      startAt: params.startAt,
      endAt: params.endAt,
      selectedExtras: params.selectedExtras || [],
      protectionPlanId: params.protectionPlanId || null,
    },
  });

  if (error) throw error;
  return data as TripQuote;
}

export function useTripQuote(params: QuoteParams | null) {
  return useQuery({
    queryKey: ["trip-quote", params?.carId, params?.startAt, params?.endAt, params?.selectedExtras, params?.protectionPlanId],
    queryFn: () => fetchQuote(params!),
    enabled: !!params?.carId && !!params?.startAt && !!params?.endAt,
    staleTime: 30_000,
  });
}
