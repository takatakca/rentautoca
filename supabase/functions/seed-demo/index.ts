// One-shot seed for the Rentauto Garage demo data.
// Idempotent: safe to call multiple times.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const HOST_EMAIL = "host@rentauto.ca";
const HOST_PASSWORD = "RentautoGarage!2026";

const CARS = [
  {
    id: "11111111-1111-1111-1111-000000000001",
    title: "Toyota Camry 2022 — Comfort midsize sedan",
    make: "Toyota", model: "Camry", year: 2022, trim: "SE",
    description:
      "Smooth, reliable midsize sedan. Great for road trips between Montreal, Quebec City and the Eastern Townships. Heated seats, Apple CarPlay, fuel-efficient 4-cylinder.",
    body_type: "sedan", seats: 5, doors: 4, fuel_type: "regular",
    transmission: "automatic", base_daily_price_cents: 6500,
    location_label: "Montreal, QC", lat: 45.5019, lng: -73.5674,
    photos: [
      "https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=1200&q=80",
      "https://images.unsplash.com/photo-1590362891991-f776e747a588?w=1200&q=80",
      "https://images.unsplash.com/photo-1502877338535-766e1452684a?w=1200&q=80",
    ],
  },
  {
    id: "11111111-1111-1111-1111-000000000002",
    title: "Honda Civic 2023 — Sporty everyday commuter",
    make: "Honda", model: "Civic", year: 2023, trim: "Sport",
    description:
      "Latest-gen Civic with a sharp interior, peppy engine and excellent fuel economy. Perfect for city driving and weekend escapes.",
    body_type: "sedan", seats: 5, doors: 4, fuel_type: "regular",
    transmission: "automatic", base_daily_price_cents: 5500,
    location_label: "Montreal, QC", lat: 45.5088, lng: -73.5878,
    photos: [
      "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=1200&q=80",
      "https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=1200&q=80",
      "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=1200&q=80",
    ],
  },
  {
    id: "11111111-1111-1111-1111-000000000003",
    title: "Nissan Rogue 2021 — Family-ready compact SUV",
    make: "Nissan", model: "Rogue", year: 2021, trim: "SV",
    description:
      "Spacious 5-seat compact SUV with all-wheel drive — perfect for ski weekends in the Laurentides or family runs.",
    body_type: "suv", seats: 5, doors: 5, fuel_type: "regular",
    transmission: "automatic", base_daily_price_cents: 8500,
    location_label: "Laval, QC", lat: 45.6066, lng: -73.7124,
    photos: [
      "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=1200&q=80",
      "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=1200&q=80",
      "https://images.unsplash.com/photo-1568844293986-8d0400bd4745?w=1200&q=80",
    ],
  },
  {
    id: "11111111-1111-1111-1111-000000000004",
    title: "Hyundai Elantra 2022 — Modern fuel-sipper",
    make: "Hyundai", model: "Elantra", year: 2022, trim: "Preferred",
    description:
      "Modern compact sedan with a stylish cabin, great fuel economy and Hyundai's comprehensive safety suite.",
    body_type: "sedan", seats: 5, doors: 4, fuel_type: "regular",
    transmission: "automatic", base_daily_price_cents: 5800,
    location_label: "Montreal, QC", lat: 45.5231, lng: -73.5817,
    photos: [
      "https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=1200&q=80",
      "https://images.unsplash.com/photo-1542362567-b07e54358753?w=1200&q=80",
      "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1200&q=80",
    ],
  },
  {
    id: "11111111-1111-1111-1111-000000000005",
    title: "Ford Escape 2021 — Versatile crossover SUV",
    make: "Ford", model: "Escape", year: 2021, trim: "SE",
    description:
      "Versatile compact SUV with a comfortable ride and generous cargo space. Great for long weekends and Quebec winter trips.",
    body_type: "suv", seats: 5, doors: 5, fuel_type: "regular",
    transmission: "automatic", base_daily_price_cents: 7900,
    location_label: "Quebec City, QC", lat: 46.8139, lng: -71.2080,
    photos: [
      "https://images.unsplash.com/photo-1612544448445-b8232cff3b6c?w=1200&q=80",
      "https://images.unsplash.com/photo-1571068316344-75bc76f77890?w=1200&q=80",
      "https://images.unsplash.com/photo-1502877338535-766e1452684a?w=1200&q=80",
    ],
  },
  {
    id: "11111111-1111-1111-1111-000000000006",
    title: "Tesla Model 3 2022 — Electric long-range",
    make: "Tesla", model: "Model 3", year: 2022, trim: "Long Range",
    description:
      "All-electric Tesla Model 3 with Autopilot, full glass roof and 500+ km range. Supercharger access for road trips.",
    body_type: "sedan", seats: 5, doors: 4, fuel_type: "electric",
    transmission: "automatic", base_daily_price_cents: 12000,
    location_label: "Montreal, QC", lat: 45.5017, lng: -73.5673,
    photos: [
      "https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=1200&q=80",
      "https://images.unsplash.com/photo-1571127236794-81c0bbfe1ce3?w=1200&q=80",
      "https://images.unsplash.com/photo-1554744512-d6c603f27c54?w=1200&q=80",
    ],
  },
];

const FEATURES = {
  safety: ["Backup camera", "Lane assist", "Blind spot monitor"],
  connectivity: ["Apple CarPlay", "Android Auto", "Bluetooth", "USB charger"],
};

const RULES = {
  refuel: true,
  keep_tidy: true,
  no_offroad: true,
  no_smoking: true,
  tidy_fee_cents: 15000,
  smoking_fee_cents: 15000,
  telematics_disclosure:
    "Vehicle may have a device that collects driving and location data.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const log: string[] = [];

    // 1. Find or create the host auth user
    let hostId: string | null = null;
    const { data: list } = await supabase.auth.admin.listUsers();
    const existing = list?.users?.find((u) => u.email === HOST_EMAIL);
    if (existing) {
      hostId = existing.id;
      log.push(`Host already exists: ${hostId}`);
    } else {
      const { data: created, error } = await supabase.auth.admin.createUser({
        email: HOST_EMAIL,
        password: HOST_PASSWORD,
        email_confirm: true,
        user_metadata: { display_name: "Rentauto Garage" },
      });
      if (error) throw new Error(`createUser: ${error.message}`);
      hostId = created.user!.id;
      log.push(`Created host: ${hostId}`);
    }

    // 2. Upsert profile
    await supabase.from("profiles").upsert({
      id: hostId,
      display_name: "Rentauto Garage",
      first_name: "Rentauto",
      last_name: "Garage",
      city: "Montreal",
      province: "QC",
      bio:
        "Rentauto Montreal Garage — Quebec's curated peer-to-peer fleet. Premium service, spotless vehicles, fast handoff.",
      is_all_star: true,
      rating_avg: 4.9,
      trips_count: 124,
    });

    // 3. Ensure host role
    await supabase
      .from("user_roles")
      .upsert({ user_id: hostId, role: "host" }, { onConflict: "user_id,role" });

    // 4. Re-tier protection plans to Basic / Silver / Gold
    await supabase.from("protection_plans").update({
      name: "Basic",
      price_per_day_cents: 1000,
      deductible_cents: 300000,
      description:
        "Minimum coverage. Lower daily cost, higher deductible if there is an incident.",
      coverage_details: [
        { label: "Liability up to $1M", included: true },
        { label: "Roadside assistance", included: true },
        { label: "Collision damage", included: false },
        { label: "Theft protection", included: false },
      ],
    }).eq("tier", "basic");

    await supabase.from("protection_plans").update({
      name: "Silver",
      price_per_day_cents: 1800,
      deductible_cents: 100000,
      description:
        "Recommended. Balanced coverage with a moderate deductible.",
      coverage_details: [
        { label: "Liability up to $2M", included: true },
        { label: "Roadside assistance", included: true },
        { label: "Collision damage", included: true },
        { label: "Theft protection", included: true },
        { label: "Loss of use", included: false },
      ],
    }).eq("tier", "standard");

    await supabase.from("protection_plans").update({
      name: "Gold",
      price_per_day_cents: 2800,
      deductible_cents: 0,
      description:
        "Maximum coverage with a $0 deductible and full peace of mind.",
      coverage_details: [
        { label: "Liability up to $2M", included: true },
        { label: "Roadside assistance", included: true },
        { label: "Collision damage", included: true },
        { label: "Theft protection", included: true },
        { label: "Loss of use", included: true },
        { label: "Tire & glass", included: true },
      ],
    }).eq("tier", "premium");

    // 5. Upsert cars
    for (const c of CARS) {
      await supabase.from("cars").upsert({
        id: c.id,
        host_id: hostId,
        status: "active",
        title: c.title,
        make: c.make,
        model: c.model,
        year: c.year,
        trim: c.trim,
        description: c.description,
        body_type: c.body_type,
        seats: c.seats,
        doors: c.doors,
        fuel_type: c.fuel_type,
        transmission: c.transmission,
        base_daily_price_cents: c.base_daily_price_cents,
        currency: "CAD",
        included_km_per_day: c.id.endsWith("06") ? 400 : 300,
        extra_km_price_cents: c.id.endsWith("06") ? 35 : 29,
        location_label: c.location_label,
        lat: c.lat,
        lng: c.lng,
        features: FEATURES,
        rules: RULES,
      });

      // Reset photos for clean reseed
      await supabase.from("car_photos").delete().eq("car_id", c.id);
      await supabase.from("car_photos").insert(
        c.photos.map((url, i) => ({ car_id: c.id, url, sort_order: i })),
      );
    }
    log.push(`Seeded ${CARS.length} cars`);

    return new Response(
      JSON.stringify({ ok: true, hostId, log }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
