import { Plane, Clock, MapPin, Luggage } from "lucide-react";
import {
  MarketingPage, MarketingSection, FeatureGrid, FAQSection, FinalCTA,
} from "@/components/marketing/MarketingPage";

const items = [
  { icon: <Plane className="h-5 w-5" />, title: "YUL & YQB pickup", body: "Hosts meet you curb-side at Montréal–Trudeau (YUL) and Québec–Jean Lesage (YQB)." },
  { icon: <Clock className="h-5 w-5" />, title: "Late flight friendly", body: "Filter for hosts who accept after-hours pickups, so a delayed arrival doesn't cost you your car." },
  { icon: <Luggage className="h-5 w-5" />, title: "No counter lines", body: "Walk straight from baggage claim to your booked car — no paperwork, no upsells." },
  { icon: <MapPin className="h-5 w-5" />, title: "Drop where you land", body: "Many hosts allow one-way returns to the same airport with no surprise fees." },
];

const faqs = [
  { q: "Is there an airport fee?", a: "Some hosts add a small airport delivery fee that's clearly displayed on the listing before you book." },
  { q: "What if my flight is delayed?", a: "Contact your host through the app — most are flexible. Use Silver or Gold protection for added peace of mind." },
  { q: "Can I return after midnight?", a: "Yes, if the host has enabled late returns. Check the listing's pickup and return windows." },
];

export default function AirportRentals() {
  return (
    <MarketingPage
      eyebrow="Airport rentals"
      title="Land in Quebec, drive away in minutes."
      subtitle="Skip the rental car shuttle. Book directly from local hosts at Montréal–Trudeau (YUL), Québec City (YQB) and more."
      primaryCta={{ label: "Browse airport cars", to: "/explore?category=Airports" }}
      secondaryCta={{ label: "How it works", to: "/how-it-works" }}
    >
      <MarketingSection title="Why book airport rentals on Rentauto">
        <FeatureGrid items={items} />
      </MarketingSection>
      <FAQSection items={faqs} />
      <FinalCTA
        title="Find a car at your airport"
        body="Search by airport code or city to see hosts offering pickup at YUL, YQB and beyond."
        primary={{ label: "Search airport cars", to: "/explore?category=Airports" }}
        secondary={{ label: "Monthly rentals", to: "/monthly-car-rentals" }}
      />
    </MarketingPage>
  );
}
