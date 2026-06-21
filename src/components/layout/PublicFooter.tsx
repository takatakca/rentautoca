import { Link } from "react-router-dom";
import { Car } from "lucide-react";

const columns = [
  {
    heading: "Explore",
    links: [
      { to: "/explore", label: "Browse cars" },
      { to: "/airport-rentals", label: "Airport rentals" },
      { to: "/monthly-car-rentals", label: "Monthly rentals" },
      { to: "/electric-vehicles", label: "Electric vehicles" },
      { to: "/luxury-rentals", label: "Luxury rentals" },
    ],
  },
  {
    heading: "Hosting",
    links: [
      { to: "/become-host", label: "List your car" },
      { to: "/for-hosts", label: "Host resources" },
      { to: "/how-it-works", label: "How it works" },
      { to: "/tracking", label: "GPS & trip safety" },
    ],
  },
  {
    heading: "Trust & safety",
    links: [
      { to: "/safety", label: "Safety overview" },
      { to: "/insurance", label: "Insurance & protection" },
      { to: "/tracking", label: "Tracking disclosure" },
      { to: "/cancellation-policy", label: "Cancellation policy" },
    ],
  },
  {
    heading: "Support",
    links: [
      { to: "/help", label: "Help centre" },
      { to: "/terms", label: "Terms of service" },
      { to: "/privacy", label: "Privacy policy" },
    ],
  },
];

const serviceAreas = [
  "Montreal", "Quebec City", "Laval", "Longueuil", "Gatineau",
  "Sherbrooke", "Trois-Rivières", "Saguenay", "YUL Airport", "YQB Airport",
];

export function PublicFooter() {
  return (
    <footer className="border-t border-border/60 bg-card/30 mt-12 hidden md:block">
      <div className="container py-12">
        <div className="grid gap-10 md:grid-cols-5">
          <div className="md:col-span-1">
            <Link to="/" className="inline-flex items-center gap-2">
              <Car className="h-7 w-7 text-primary" />
              <span className="text-lg font-bold">Rentauto</span>
            </Link>
            <p className="mt-3 text-sm text-muted-foreground max-w-xs">
              Peer-to-peer car rental across Quebec and Canada. Skip the counter — rent from local hosts.
            </p>
          </div>
          {columns.map((col) => (
            <div key={col.heading}>
              <h3 className="text-sm font-semibold text-foreground mb-3">{col.heading}</h3>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 pt-8 border-t border-border/60">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            Quebec service areas
          </h3>
          <div className="flex flex-wrap gap-2">
            {serviceAreas.map((area) => (
              <Link
                key={area}
                to={`/explore?location=${encodeURIComponent(area)}`}
                className="text-xs px-3 py-1.5 rounded-full border border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
              >
                {area}
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-border/60 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} Rentauto.ca — Canada's peer-to-peer car rental marketplace.</p>
          <p>Built in Quebec. Bilingual support: support@rentauto.ca</p>
        </div>
      </div>
    </footer>
  );
}
