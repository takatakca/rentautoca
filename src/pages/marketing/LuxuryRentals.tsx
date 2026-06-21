import { Sparkles, Crown, Gem, Briefcase } from "lucide-react";
import {
  MarketingPage, MarketingSection, FeatureGrid, FAQSection, FinalCTA,
} from "@/components/marketing/MarketingPage";

const items = [
  { icon: <Sparkles className="h-5 w-5" />, title: "Curated fleet", body: "BMW M, Mercedes-AMG, Porsche, Audi RS, and select exotics from trusted local hosts." },
  { icon: <Crown className="h-5 w-5" />, title: "Special occasions", body: "Weddings, anniversaries, business dinners — arrive in something that makes the moment." },
  { icon: <Briefcase className="h-5 w-5" />, title: "Business travel", body: "Make your next client meeting in Montreal or Quebec City a little more memorable." },
  { icon: <Gem className="h-5 w-5" />, title: "Concierge-grade hosts", body: "Luxury hosts often offer delivery, detailed walk-throughs, and flexible pickup windows." },
];

const faqs = [
  { q: "Is there a deposit?", a: "Luxury and exotic listings often require a refundable hold to cover the higher deductible. The exact amount is shown at checkout." },
  { q: "Are there age restrictions?", a: "Many luxury listings require drivers 25+ with a clean record. Filters and host rules show on every listing." },
  { q: "Can I use Gold protection?", a: "Yes — Gold is recommended for luxury rentals to lower your deductible." },
];

export default function LuxuryRentals() {
  return (
    <MarketingPage
      eyebrow="Luxury rentals"
      title="Make the trip itself worth remembering."
      subtitle="From AMG to M, Rentauto's luxury fleet lets you drive premium without long-term ownership."
      primaryCta={{ label: "Browse luxury cars", to: "/explore" }}
      secondaryCta={{ label: "Electric vehicles", to: "/electric-vehicles" }}
    >
      <MarketingSection title="What luxury rentals include">
        <FeatureGrid items={items} />
      </MarketingSection>
      <FAQSection items={faqs} />
      <FinalCTA
        title="Find your weekend car"
        body="Browse premium vehicles available across Quebec and book in minutes."
        primary={{ label: "Browse luxury cars", to: "/explore" }}
        secondary={{ label: "Insurance & protection", to: "/insurance" }}
      />
    </MarketingPage>
  );
}
