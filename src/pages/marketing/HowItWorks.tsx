import { Search, FileCheck, KeyRound, Car, Star, Shield } from "lucide-react";
import {
  MarketingPage, MarketingSection, FeatureGrid, FAQSection, FinalCTA,
} from "@/components/marketing/MarketingPage";

const steps = [
  { icon: <Search className="h-5 w-5" />, title: "1. Search & filter", body: "Pick your city, dates, and the vehicle that fits your trip — sedan, SUV, EV, or luxury." },
  { icon: <FileCheck className="h-5 w-5" />, title: "2. Book in minutes", body: "Add your licence once, choose a protection plan, and request the trip. Most hosts respond within an hour." },
  { icon: <KeyRound className="h-5 w-5" />, title: "3. Pick up the car", body: "Meet the host at the agreed location, snap walk-around photos in-app, and drive away." },
  { icon: <Car className="h-5 w-5" />, title: "4. Enjoy your trip", body: "GPS tracking is active for safety, support is one tap away, and incidents can be reported in seconds." },
  { icon: <KeyRound className="h-5 w-5" />, title: "5. Return the car", body: "Refuel to the level shown at pickup, take exit photos, and hand back the keys." },
  { icon: <Star className="h-5 w-5" />, title: "6. Rate your host", body: "Help the community by leaving a review — it improves trust for everyone." },
];

const faqs = [
  { q: "How long does approval take?", a: "Most trip requests are accepted within an hour during business hours. Instant Book listings confirm immediately." },
  { q: "When does payment happen?", a: "Your card is authorized at booking and charged once the host confirms. Refunds follow our cancellation policy." },
  { q: "What's a Protection Plan?", a: "It's the insurance bundle attached to every trip. Basic, Silver, and Gold tiers differ in deductible and roadside benefits." },
  { q: "What if the car is dirty or low on fuel?", a: "Capture it in your pickup photos and contact support. We use the photo evidence to resolve fuel and cleaning disputes fairly." },
];

export default function HowItWorks() {
  return (
    <MarketingPage
      eyebrow="How it works"
      title="Rent a car in three taps. Drive in minutes."
      subtitle="Rentauto connects you with verified local hosts so you can skip rental counters, fees, and shuttles."
      primaryCta={{ label: "Browse cars", to: "/explore" }}
      secondaryCta={{ label: "Become a host", to: "/become-host" }}
    >
      <MarketingSection title="From search to return">
        <FeatureGrid items={steps} />
      </MarketingSection>

      <MarketingSection
        title="Backed by real protection"
        description="Every Rentauto trip comes with a Protection Plan covering liability and physical damage."
      >
        <div className="grid md:grid-cols-3 gap-4">
          {["Basic", "Silver", "Gold"].map((tier) => (
            <div key={tier} className="rounded-2xl border border-border/60 bg-card p-6">
              <Shield className="h-5 w-5 text-primary mb-3" />
              <h3 className="font-semibold">{tier} plan</h3>
              <p className="text-sm text-muted-foreground mt-1.5">
                {tier === "Basic" && "Required minimum coverage with a higher deductible."}
                {tier === "Silver" && "Lower deductible, plus 24/7 roadside assistance."}
                {tier === "Gold" && "Lowest deductible, roadside, and waived appearance fees."}
              </p>
            </div>
          ))}
        </div>
      </MarketingSection>

      <FAQSection items={faqs} />
      <FinalCTA />
    </MarketingPage>
  );
}
