import { Zap, Leaf, Gauge, BatteryCharging } from "lucide-react";
import {
  MarketingPage, MarketingSection, FeatureGrid, FAQSection, FinalCTA,
} from "@/components/marketing/MarketingPage";

const items = [
  { icon: <Zap className="h-5 w-5" />, title: "Tesla, Polestar, Ioniq, EV6", body: "Rent the EV you've been curious about before you commit to buying one." },
  { icon: <BatteryCharging className="h-5 w-5" />, title: "Charging guidance", body: "Hosts share charger access, supported networks, and tips for road trips across Quebec." },
  { icon: <Gauge className="h-5 w-5" />, title: "Instant torque", body: "Test long-range performance, one-pedal driving, and modern interiors on real roads." },
  { icon: <Leaf className="h-5 w-5" />, title: "Lower emissions", body: "Quebec's clean hydro-electric grid makes EV trips dramatically lower-carbon than gas." },
];

const faqs = [
  { q: "Do I need to return the car fully charged?", a: "Each listing sets its own return condition — typically the same charge level as pickup." },
  { q: "Where can I charge in Quebec?", a: "Circuit Électrique, FLO, Tesla Superchargers and Electrify Canada are widely available across the province." },
  { q: "Is there an EV surcharge?", a: "No platform surcharge. The listing's daily rate is what you pay — plus taxes and your chosen Protection Plan." },
];

export default function ElectricVehicles() {
  return (
    <MarketingPage
      eyebrow="Electric vehicles"
      title="Drive an EV without buying one."
      subtitle="Try the latest Teslas, Polestars, Hyundai Ioniqs and Kia EV6s from local Quebec hosts."
      primaryCta={{ label: "Browse EVs", to: "/explore" }}
      secondaryCta={{ label: "Luxury rentals", to: "/luxury-rentals" }}
    >
      <MarketingSection title="Why rent an EV on Rentauto">
        <FeatureGrid items={items} />
      </MarketingSection>
      <FAQSection items={faqs} />
      <FinalCTA
        title="Plug into your next trip"
        body="Find an electric vehicle that fits your route and start your trip in minutes."
        primary={{ label: "Browse EVs", to: "/explore" }}
        secondary={{ label: "Luxury cars", to: "/luxury-rentals" }}
      />
    </MarketingPage>
  );
}
