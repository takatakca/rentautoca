import { DollarSign, Calendar, Shield, MapPin, Camera, Wallet, TrendingUp, Settings } from "lucide-react";
import {
  MarketingPage, MarketingSection, FeatureGrid, FAQSection, FinalCTA,
} from "@/components/marketing/MarketingPage";

const benefits = [
  { icon: <DollarSign className="h-5 w-5" />, title: "Real earning potential", body: "Active hosts in Quebec earn $400–$1,500+ per car per month depending on availability and category." },
  { icon: <Calendar className="h-5 w-5" />, title: "Total calendar control", body: "Block dates anytime, set advance notice, weekend minimums, and instant or request-only bookings." },
  { icon: <Wallet className="h-5 w-5" />, title: "Stripe payouts in CAD", body: "Direct deposit to your Canadian bank after each completed trip via Stripe Connect." },
  { icon: <Shield className="h-5 w-5" />, title: "Host protection", body: "Trip-time protection plan, deposit hold, ID-verified guests, and clear incident workflows." },
  { icon: <Camera className="h-5 w-5" />, title: "Photo check-in/out", body: "Time-stamped pickup and return photos document vehicle condition before and after each trip." },
  { icon: <MapPin className="h-5 w-5" />, title: "GPS during trips", body: "If a device is installed, GPS is only active while the rental is live — never before, never after." },
];

const faqs = [
  { q: "Do I need commercial insurance?", a: "Every Rentauto trip includes a Protection Plan that covers physical damage and liability during the rental window. You still need a valid personal auto policy when the car is not being rented." },
  { q: "Who picks up the car?", a: "You do, or you can offer delivery (curb-side, airport, or door) for an additional fee that you set." },
  { q: "How do payouts work?", a: "After a trip completes and the dispute window closes, your share is paid out via Stripe Connect to your Canadian bank account, typically within 1–3 business days." },
  { q: "Can I host more than one car?", a: "Yes. Manage multiple listings, calendars, and pricing from one host dashboard." },
];

export default function ForHosts() {
  return (
    <MarketingPage
      eyebrow="For hosts"
      title="Earn meaningful income with the car you already own."
      subtitle="List in minutes, approve every booking, and get paid through Stripe. You stay in control of price, availability, and rules."
      primaryCta={{ label: "Start hosting", to: "/become-host" }}
      secondaryCta={{ label: "How it works", to: "/how-it-works" }}
    >
      <MarketingSection title="Why hosts choose Rentauto">
        <FeatureGrid items={benefits} />
      </MarketingSection>

      <MarketingSection
        title="What you control"
        description="Your car, your rules. Rentauto gives you the tooling to run it like a small business."
      >
        <div className="grid md:grid-cols-2 gap-4">
          {[
            { icon: <Settings className="h-5 w-5" />, title: "Pricing", body: "Daily, weekly and monthly rates, automatic length-of-trip discounts, and extras like delivery or child seats." },
            { icon: <TrendingUp className="h-5 w-5" />, title: "Performance", body: "See bookings, conversion, ratings, and earnings in your host dashboard." },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-border/60 bg-card p-6">
              <div className="w-11 h-11 rounded-xl bg-accent text-accent-foreground flex items-center justify-center mb-3">
                {item.icon}
              </div>
              <h3 className="font-semibold">{item.title}</h3>
              <p className="text-sm text-muted-foreground mt-1.5">{item.body}</p>
            </div>
          ))}
        </div>
      </MarketingSection>

      <FAQSection items={faqs} />
      <FinalCTA
        title="Ready to list your first car?"
        body="Set up takes about 15 minutes. We'll guide you through photos, pricing and Stripe."
        primary={{ label: "Become a host", to: "/become-host" }}
        secondary={{ label: "Talk to support", to: "/help" }}
      />
    </MarketingPage>
  );
}
