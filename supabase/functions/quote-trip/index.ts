import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { carId, startAt, endAt, selectedExtras, protectionPlanId } = await req.json();

    if (!carId || !startAt || !endAt) {
      return new Response(JSON.stringify({ error: "carId, startAt, endAt required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch car
    const { data: car, error: carErr } = await supabase
      .from("cars")
      .select("*")
      .eq("id", carId)
      .single();

    if (carErr || !car) {
      return new Response(JSON.stringify({ error: "Car not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (car.status !== "active") {
      return new Response(JSON.stringify({ error: "Vehicle is not available" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check availability
    const { data: blocks } = await supabase
      .from("availability_blocks")
      .select("id")
      .eq("car_id", carId)
      .lt("start_at", endAt)
      .gt("end_at", startAt)
      .limit(1);

    if (blocks && blocks.length > 0) {
      return new Response(JSON.stringify({ error: "Dates not available" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate days
    const start = new Date(startAt);
    const end = new Date(endAt);
    const diffMs = end.getTime() - start.getTime();
    const days = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

    const basePrice = car.base_daily_price_cents * days;

    // Extras
    let extrasTotal = 0;
    const extrasBreakdown: { name: string; price_cents: number }[] = [];
    if (selectedExtras && selectedExtras.length > 0) {
      const { data: extras } = await supabase
        .from("car_extras")
        .select("*")
        .eq("car_id", carId)
        .eq("is_active", true)
        .in("id", selectedExtras);

      for (const extra of extras || []) {
        const cost = extra.pricing_type === "per_day" ? extra.price_cents * days : extra.price_cents;
        extrasTotal += cost;
        extrasBreakdown.push({ name: extra.name, price_cents: cost });
      }
    }

    // Weekly discount (5% for 3+ days, 10% for 7+ days)
    let discountPercent = 0;
    if (days >= 7) discountPercent = 10;
    else if (days >= 3) discountPercent = 5;
    const discounts = Math.round(basePrice * discountPercent / 100);

    const subtotal = basePrice + extrasTotal - discounts;

    // Quebec GST (5%) + QST (9.975%) as default; simplified
    const gstRate = 0.05;
    const qstRate = 0.09975;
    const taxes = Math.round(subtotal * (gstRate + qstRate));

    const totalBeforeTax = subtotal;
    const totalAfterTax = subtotal + taxes;
    const includedKmTotal = car.included_km_per_day * days;

    // Cancellation policy snapshot
    const { data: policyLink } = await supabase
      .from("car_policies")
      .select("cancellation_policies(name, summary, rules)")
      .eq("car_id", carId)
      .limit(1)
      .maybeSingle();

    const quote = {
      days,
      base_price: basePrice,
      extras_total: extrasTotal,
      extras_breakdown: extrasBreakdown,
      protection_total: 0,
      discounts,
      discount_percent: discountPercent,
      taxes,
      total_before_tax: totalBeforeTax,
      total_after_tax: totalAfterTax,
      included_km_total: includedKmTotal,
      extra_km_price: car.extra_km_price_cents,
      currency: car.currency,
      cancellation_policy_snapshot: (policyLink as any)?.cancellation_policies || null,
    };

    return new Response(JSON.stringify(quote), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
