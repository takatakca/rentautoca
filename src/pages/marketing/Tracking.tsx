import { MapPin, Clock, EyeOff, Shield, Lock, AlertTriangle } from "lucide-react";
import {
  MarketingPage, MarketingSection, FeatureGrid, FAQSection, FinalCTA,
} from "@/components/marketing/MarketingPage";

const items = [
  { icon: <Clock className="h-5 w-5" />, title: "Active only during trips", body: "GPS data is collected strictly between check-in and check-out. Before and after, tracking is off." },
  { icon: <EyeOff className="h-5 w-5" />, title: "Not for surveillance", body: "Hosts and Rentauto staff cannot use location history for marketing or unrelated purposes." },
  { icon: <Lock className="h-5 w-5" />, title: "Encrypted in transit", body: "All location pings travel over HTTPS and are stored with row-level access controls." },
  { icon: <Shield className="h-5 w-5" />, title: "Safety, theft & recovery", body: "Tracking supports incident response, theft recovery, and fair resolution of disputes." },
  { icon: <MapPin className="h-5 w-5" />, title: "Live for emergencies", body: "If a guest reports an emergency, support can use the live location to assist response teams." },
  { icon: <AlertTriangle className="h-5 w-5" />, title: "Disclosed before booking", body: "Listings that include tracking display a clear disclosure before you confirm the booking." },
];

const faqs = [
  { q: "Do all cars have GPS?", a: "No. GPS is provided by the host when they install a compatible device. Listings disclose whether tracking is enabled." },
  { q: "Who can see my location?", a: "During an active trip, the host can see live status. Rentauto support can access it for safety, disputes, or fraud investigations." },
  { q: "Is the data shared with third parties?", a: "No. Location data is used only for the operation of Rentauto and is never sold." },
  { q: "How long is the data kept?", a: "Tracking data tied to a trip is retained only as long as needed to support disputes, claims, and legal obligations." },
];

export default function Tracking() {
  return (
    <MarketingPage
      eyebrow="GPS tracking"
      title="Privacy-first tracking, only during your trip."
      subtitle="When a host has enabled vehicle GPS, location data is collected for safety — only while your rental is active, and never before or after."
      primaryCta={{ label: "Safety overview", to: "/safety" }}
      secondaryCta={{ label: "Privacy policy", to: "/privacy" }}
    >
      <MarketingSection title="How Rentauto handles GPS">
        <FeatureGrid items={items} />
      </MarketingSection>
      <FAQSection items={faqs} />
      <FinalCTA
        title="Drive knowing the rules are clear"
        body="Read the privacy policy or browse cars with full transparency about tracking."
        primary={{ label: "Browse cars", to: "/explore" }}
        secondary={{ label: "Privacy policy", to: "/privacy" }}
      />
    </MarketingPage>
  );
}
