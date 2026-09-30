import { createClient } from "jsr:@supabase/supabase-js@2";

export type PricingAdminClient = ReturnType<typeof createClient>;

export type TripQuoteInput = {
  carId: string;
  startAt: string;
  endAt: string;
  selectedExtras?: string[];
  protectionPlanId?: string | null;
  ignoreHoldTripId?: string | null;
};

export type TripQuote = {
  pricing_version: string;
  quoted_at: string;
  tax_jurisdiction: "QC";
  days: number;
  base_price: number;
  extras_total: number;
  extras_breakdown: Array<{
    id: string;
    name: string;
    price_cents: number;
  }>;
  selected_extra_ids: string[];
  protection_plan_id: string | null;
  protection_total: number;
  protection_snapshot: Record<string, unknown> | null;
  discounts: number;
  discount_percent: number;
  gst: number;
  gst_rate: number;
  qst: number;
  qst_rate: number;
  taxes: number;
  total_before_tax: number;
  total_after_tax: number;
  included_km_total: number;
  extra_km_price: number;
  currency: string;
  cancellation_policy_snapshot: unknown;
};

export class TripQuoteError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
  ) {
    super(code);
    this.name = "TripQuoteError";
  }
}

function normalizeExtraIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const ids = input.filter(
    (value): value is string =>
      typeof value === "string" && value.length > 0 && value.length <= 100,
  );
  return [...new Set(ids)].slice(0, 20);
}

export async function buildTripQuote(
  admin: PricingAdminClient,
  input: TripQuoteInput,
): Promise<TripQuote> {
  const start = new Date(input.startAt);
  const end = new Date(input.endAt);

  if (
    !input.carId ||
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end <= start
  ) {
    throw new TripQuoteError("INVALID_TRIP_DATES", 400);
  }

  const diffMs = end.getTime() - start.getTime();
  const maximumMs = 365 * 24 * 60 * 60 * 1000;
  if (diffMs > maximumMs) {
    throw new TripQuoteError("TRIP_DURATION_TOO_LONG", 400);
  }

  const { data: car, error: carError } = await admin
    .from("cars")
    .select(
      "id,status,base_daily_price_cents,included_km_per_day,extra_km_price_cents,currency",
    )
    .eq("id", input.carId)
    .maybeSingle();

  if (carError || !car) {
    throw new TripQuoteError("VEHICLE_NOT_FOUND", 404);
  }

  if (car.status !== "active") {
    throw new TripQuoteError("VEHICLE_NOT_AVAILABLE", 409);
  }

  const { data: blocks, error: blockError } = await admin
    .from("availability_blocks")
    .select("id")
    .eq("car_id", input.carId)
    .lt("start_at", input.endAt)
    .gt("end_at", input.startAt)
    .limit(1);

  if (blockError) {
    throw new TripQuoteError("AVAILABILITY_CHECK_FAILED", 500);
  }
  if (blocks && blocks.length > 0) {
    throw new TripQuoteError("DATES_NOT_AVAILABLE", 409);
  }

  let holdQuery = admin
    .from("booking_holds")
    .select("id")
    .eq("car_id", input.carId)
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .lt("start_at", input.endAt)
    .gt("end_at", input.startAt);

  if (input.ignoreHoldTripId) {
    holdQuery = holdQuery.neq("trip_id", input.ignoreHoldTripId);
  }

  const { data: holds, error: holdError } = await holdQuery.limit(1);
  if (holdError) {
    throw new TripQuoteError("HOLD_CHECK_FAILED", 500);
  }
  if (holds && holds.length > 0) {
    throw new TripQuoteError("DATES_TEMPORARILY_HELD", 409);
  }

  const days = Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
  const basePrice = car.base_daily_price_cents * days;

  const selectedExtraIds = normalizeExtraIds(input.selectedExtras);
  let extrasTotal = 0;
  const extrasBreakdown: TripQuote["extras_breakdown"] = [];

  if (selectedExtraIds.length > 0) {
    const { data: extras, error: extrasError } = await admin
      .from("car_extras")
      .select("id,name,price_cents,pricing_type")
      .eq("car_id", input.carId)
      .eq("is_active", true)
      .in("id", selectedExtraIds);

    if (extrasError) {
      throw new TripQuoteError("EXTRAS_LOOKUP_FAILED", 500);
    }

    if ((extras ?? []).length !== selectedExtraIds.length) {
      throw new TripQuoteError("INVALID_EXTRA_SELECTION", 400);
    }

    for (const extra of extras ?? []) {
      const cost =
        extra.pricing_type === "per_day"
          ? extra.price_cents * days
          : extra.price_cents;
      extrasTotal += cost;
      extrasBreakdown.push({
        id: extra.id,
        name: extra.name,
        price_cents: cost,
      });
    }
  }

  let discountPercent = 0;
  if (days >= 7) discountPercent = 10;
  else if (days >= 3) discountPercent = 5;
  const discounts = Math.round((basePrice * discountPercent) / 100);

  let protectionTotal = 0;
  let protectionSnapshot: Record<string, unknown> | null = null;
  let protectionPlanId: string | null = null;

  if (input.protectionPlanId) {
    const { data: plan, error: planError } = await admin
      .from("protection_plans")
      .select("id,name,tier,price_per_day_cents,deductible_cents")
      .eq("id", input.protectionPlanId)
      .eq("is_active", true)
      .maybeSingle();

    if (planError) {
      throw new TripQuoteError("PROTECTION_LOOKUP_FAILED", 500);
    }
    if (!plan) {
      throw new TripQuoteError("INVALID_PROTECTION_PLAN", 400);
    }

    protectionPlanId = plan.id;
    protectionTotal = plan.price_per_day_cents * days;
    protectionSnapshot = {
      id: plan.id,
      name: plan.name,
      tier: plan.tier,
      price_per_day_cents: plan.price_per_day_cents,
      deductible_cents: plan.deductible_cents,
      total_cents: protectionTotal,
    };
  }

  const subtotal = basePrice + extrasTotal + protectionTotal - discounts;
  if (!Number.isSafeInteger(subtotal) || subtotal < 0) {
    throw new TripQuoteError("INVALID_PRICE_RESULT", 500);
  }

  const gstRate = 0.05;
  const qstRate = 0.09975;
  const gst = Math.round(subtotal * gstRate);
  const qst = Math.round(subtotal * qstRate);
  const taxes = gst + qst;
  const totalAfterTax = subtotal + taxes;

  const { data: policyLink, error: policyError } = await admin
    .from("car_policies")
    .select("cancellation_policies(name,summary,rules)")
    .eq("car_id", input.carId)
    .limit(1)
    .maybeSingle();

  if (policyError) {
    throw new TripQuoteError("POLICY_LOOKUP_FAILED", 500);
  }

  const cancellationPolicy =
    (
      policyLink as
        | { cancellation_policies?: unknown }
        | null
    )?.cancellation_policies ?? null;

  return {
    pricing_version: "qc-v1",
    quoted_at: new Date().toISOString(),
    tax_jurisdiction: "QC",
    days,
    base_price: basePrice,
    extras_total: extrasTotal,
    extras_breakdown: extrasBreakdown,
    selected_extra_ids: selectedExtraIds,
    protection_plan_id: protectionPlanId,
    protection_total: protectionTotal,
    protection_snapshot: protectionSnapshot,
    discounts,
    discount_percent: discountPercent,
    gst,
    gst_rate: gstRate,
    qst,
    qst_rate: qstRate,
    taxes,
    total_before_tax: subtotal,
    total_after_tax: totalAfterTax,
    included_km_total: car.included_km_per_day * days,
    extra_km_price: car.extra_km_price_cents,
    currency: (car.currency || "CAD").toUpperCase(),
    cancellation_policy_snapshot: cancellationPolicy,
  };
}
