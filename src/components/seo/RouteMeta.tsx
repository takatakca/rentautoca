import { Helmet } from "react-helmet-async";
import { useLocation, matchPath } from "react-router-dom";

const SITE = (
  (import.meta.env.VITE_APP_URL as string | undefined) || "https://rentautoca.lovable.app"
).replace(/\/$/, "");

type Meta = { title: string; description: string };

const ROUTES: Array<{ pattern: string; meta: Meta }> = [
  {
    pattern: "/",
    meta: {
      title: "Rentauto.ca — Peer-to-peer car rental in Canada",
      description:
        "Rent cars from trusted local hosts across Canada. Skip the rental counter and book unique vehicles at great prices.",
    },
  },
  {
    pattern: "/explore",
    meta: {
      title: "Explore cars to rent in Canada | Rentauto.ca",
      description:
        "Browse hundreds of cars, SUVs and trucks available to rent from local hosts. Filter by city, dates and vehicle type.",
    },
  },
  {
    pattern: "/cars/:carId",
    meta: {
      title: "Car details — Book this vehicle | Rentauto.ca",
      description:
        "See photos, pricing, protection plans and availability for this vehicle. Reserve directly from the host on Rentauto.ca.",
    },
  },
  {
    pattern: "/favorites",
    meta: {
      title: "Your favorite cars | Rentauto.ca",
      description: "Saved vehicles you can return to and book whenever you're ready to plan your next trip.",
    },
  },
  {
    pattern: "/trips",
    meta: {
      title: "Your trips | Rentauto.ca",
      description: "Manage upcoming and past car rentals, view trip details and contact your host.",
    },
  },
  {
    pattern: "/trips/:tripId",
    meta: {
      title: "Trip details | Rentauto.ca",
      description: "View pickup, return, pricing and host details for your Rentauto trip.",
    },
  },
  {
    pattern: "/trips/:tripId/check-in",
    meta: { title: "Trip check-in | Rentauto.ca", description: "Confirm pickup, capture vehicle photos, odometer and fuel, and start your Rentauto trip." },
  },
  {
    pattern: "/trips/:tripId/check-out",
    meta: { title: "Trip check-out | Rentauto.ca", description: "Return your rental: capture final photos, odometer and fuel, then end the trip." },
  },
  {
    pattern: "/trips/:tripId/report-issue",
    meta: { title: "Report a trip issue | Rentauto.ca", description: "Report damage, accidents, late returns or other incidents related to your Rentauto rental." },
  },
  {
    pattern: "/checkout/:tripId",
    meta: {
      title: "Review and confirm your booking | Rentauto.ca",
      description: "Review trip dates, pricing and protection coverage before confirming your car rental on Rentauto.ca.",
    },
  },
  {
    pattern: "/messages",
    meta: {
      title: "Messages | Rentauto.ca",
      description: "Chat with your host or guest about pickup, return and trip details.",
    },
  },
  {
    pattern: "/profile",
    meta: {
      title: "Your profile | Rentauto.ca",
      description: "Manage your Rentauto account, verification and personal information.",
    },
  },
  {
    pattern: "/more",
    meta: {
      title: "Account & settings | Rentauto.ca",
      description: "Account settings, verification and quick links for your Rentauto experience.",
    },
  },
  {
    pattern: "/become-host",
    meta: {
      title: "Become a host — Earn with your car | Rentauto.ca",
      description:
        "List your car on Rentauto.ca and earn meaningful income renting to verified Canadian drivers.",
    },
  },
  {
    pattern: "/host",
    meta: {
      title: "Host dashboard | Rentauto.ca",
      description: "Track earnings, bookings and your fleet performance as a Rentauto host.",
    },
  },
  {
    pattern: "/host/onboarding",
    meta: {
      title: "Host onboarding | Rentauto.ca",
      description: "Complete the steps required to start earning with your car on Rentauto.ca.",
    },
  },
  {
    pattern: "/host/cars",
    meta: {
      title: "Your vehicles | Rentauto.ca",
      description: "Manage your listings, pricing, photos and availability on Rentauto.ca.",
    },
  },
  {
    pattern: "/host/cars/:id/edit",
    meta: {
      title: "Edit your vehicle | Rentauto.ca",
      description: "Update vehicle details, pricing, extras, photos and availability blocks.",
    },
  },
  {
    pattern: "/admin",
    meta: {
      title: "Admin panel | Rentauto.ca",
      description: "Internal moderation and oversight tools for the Rentauto.ca marketplace.",
    },
  },
  {
    pattern: "/terms",
    meta: {
      title: "Terms of service | Rentauto.ca",
      description: "Read the Terms of Service that govern your use of Rentauto.ca in Canada.",
    },
  },
  {
    pattern: "/privacy",
    meta: {
      title: "Privacy policy | Rentauto.ca",
      description: "How Rentauto.ca collects, uses and protects your personal information under PIPEDA and Quebec Law 25.",
    },
  },
  {
    pattern: "/insurance",
    meta: {
      title: "Insurance & protection plans | Rentauto.ca",
      description: "Understand the Basic, Silver and Gold protection plans available for trips on Rentauto.ca.",
    },
  },
  {
    pattern: "/cancellation-policy",
    meta: {
      title: "Cancellation policy | Rentauto.ca",
      description: "Cancellation windows, refunds and host policies for trips booked on Rentauto.ca.",
    },
  },
  {
    pattern: "/help",
    meta: {
      title: "Help center | Rentauto.ca",
      description: "Answers to common questions about renting and hosting cars on Rentauto.ca.",
    },
  },
  {
    pattern: "/login",
    meta: {
      title: "Log in to Rentauto.ca",
      description: "Sign in to your Rentauto.ca account to book cars or manage your hosting business.",
    },
  },
  {
    pattern: "/signup",
    meta: {
      title: "Create your Rentauto.ca account",
      description: "Join Rentauto.ca to rent cars from local hosts or list your own vehicle across Canada.",
    },
  },
  {
    pattern: "/forgot-password",
    meta: {
      title: "Reset your password | Rentauto.ca",
      description: "Request a password reset link for your Rentauto.ca account.",
    },
  },
  {
    pattern: "/reset-password",
    meta: {
      title: "Choose a new password | Rentauto.ca",
      description: "Set a new password to regain access to your Rentauto.ca account.",
    },
  },
];

const FALLBACK: Meta = {
  title: "Rentauto.ca — Peer-to-peer car rental in Canada",
  description:
    "Rent cars from trusted local hosts across Canada. Skip the rental counter and book unique vehicles at great prices.",
};

export function RouteMeta() {
  const { pathname } = useLocation();
  const matched = ROUTES.find((r) => matchPath({ path: r.pattern, end: true }, pathname));
  const meta = matched?.meta ?? FALLBACK;
  const canonical = `${SITE}${pathname === "/" ? "/" : pathname.replace(/\/$/, "")}`;

  return (
    <Helmet>
      <title>{meta.title}</title>
      <meta name="description" content={meta.description} />
      <link rel="canonical" href={canonical} />
      <meta property="og:title" content={meta.title} />
      <meta property="og:description" content={meta.description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:type" content="website" />
    </Helmet>
  );
}
