import { CalendarDays, Home, BadgePercent, Wrench } from "lucide-react";
import {
  MarketingPage, MarketingSection, FeatureGrid, FAQSection, FinalCTA,
} from "@/components/marketing/MarketingPage";

const items = [
  { icon: <CalendarDays className="h-5 w-5" />, title: "28+ day discounts", body: "Hosts who offer monthly rentals automatically apply a long-trip discount at checkout." },
  { icon: <Home className="h-5 w-5" />, title: "Perfect between leases", body: "Bridge a move, a relocation, or a vehicle write-off without committing to ownership." },
  { icon: <BadgePercent className="h-5 w-5" />, title: "Transparent pricing", body: "No hidden mileage caps or junk fees. Your daily rate, taxes, and protection are itemized upfront." },
  { icon: <Wrench className="h-5 w-5" />, title: "Maintained by hosts", body: "Routine maintenance is the host's responsibility. You drive — they handle upkeep between trips." },
];

const faqs = [
  { q: "How many kilometres are included monthly?", a: "Most monthly listings include 2,000–4,000 km. The exact allowance shows on each listing along with any overage rate." },
  { q: "Can I extend my rental?", a: "Yes. Request an extension through the trip screen and the host will confirm if the calendar allows it." },
  { q: "Is insurance included for the full month?", a: "Yes. Your selected Protection Plan covers the entire booked period." },
];

export default function MonthlyRentals() {
  return (
    <MarketingPage
      eyebrow="Monthly rentals"
      title="Long-stay rentals across Quebec."
      subtitle="Renting for a month or longer? Get hosts who specialize in extended trips at locked-in monthly rates."
      primaryCta={{ label: "Browse monthly cars", to: "/explore?category=Monthly" }}
      secondaryCta={{ label: "How it works", to: "/how-it-works" }}
    >
      <MarketingSection title="Why monthly with Rentauto">
        <FeatureGrid items={items} />
      </MarketingSection>
      <FAQSection items={faqs} />
      <FinalCTA
        title="Find your monthly car"
        body="Search cars offering monthly rentals in Montreal, Quebec City, Laval, Gatineau and more."
        primary={{ label: "Browse monthly cars", to: "/explore?category=Monthly" }}
        secondary={{ label: "See airport options", to: "/airport-rentals" }}
      />
    </MarketingPage>
  );
}
