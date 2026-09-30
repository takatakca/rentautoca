import { ShieldCheck, Camera, IdCard, Phone, AlertTriangle, MapPin } from "lucide-react";
import {
  MarketingPage, MarketingSection, FeatureGrid, FAQSection, FinalCTA,
} from "@/components/marketing/MarketingPage";

const items = [
  { icon: <IdCard className="h-5 w-5" />, title: "Verified identities", body: "Every guest provides a government ID and driver's licence verified before booking." },
  { icon: <ShieldCheck className="h-5 w-5" />, title: "Protection on every trip", body: "Protection terms are shown before payment and are activated only when supported by the applicable production insurance arrangement." },
  { icon: <Camera className="h-5 w-5" />, title: "Pickup & return photos", body: "Time-stamped photos and odometer/fuel readings document the car's condition at both ends." },
  { icon: <MapPin className="h-5 w-5" />, title: "In-trip GPS (when enabled)", body: "If the host has installed a tracker, GPS is only active during the active rental window." },
  { icon: <AlertTriangle className="h-5 w-5" />, title: "Incident reporting", body: "Report damage, accidents, or late returns directly from the trip screen in seconds." },
  { icon: <Phone className="h-5 w-5" />, title: "24/7 roadside (Silver/Gold)", body: "Assistance details, when included with a production protection option, are shown in the trip-specific terms before payment." },
];

const faqs = [
  { q: "What if there's an accident?", a: "Make sure everyone is safe, call 911 if needed, then report the incident in the app. Our team will guide you through next steps and insurance." },
  { q: "How are damage disputes resolved?", a: "We use the pickup and return photos plus host/guest statements to assess responsibility. Decisions are issued in writing." },
  { q: "Can I trust the host's car?", a: "Hosts upload vehicle registration, insurance proof, and verified photos before they can publish a listing." },
];

export default function Safety() {
  return (
    <MarketingPage
      eyebrow="Safety"
      title="Confidence built into every trip."
      subtitle="From verified identities to time-stamped pickup photos, Rentauto is designed so both guests and hosts can rent with peace of mind."
      primaryCta={{ label: "How tracking works", to: "/tracking" }}
      secondaryCta={{ label: "Insurance details", to: "/insurance" }}
    >
      <MarketingSection title="Layered protection">
        <FeatureGrid items={items} />
      </MarketingSection>
      <FAQSection items={faqs} />
      <FinalCTA
        title="Book with confidence"
        body="Every trip uses verified-user, inspection and safety workflows; applicable protection terms are disclosed before payment."
        primary={{ label: "Browse cars", to: "/explore" }}
        secondary={{ label: "Insurance & protection", to: "/insurance" }}
      />
    </MarketingPage>
  );
}
