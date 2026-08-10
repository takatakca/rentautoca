import { Link } from "react-router-dom";
import { exploreUrl } from "@/lib/search-state";
import montreal from "@/assets/loc-montreal.jpg";
import quebec from "@/assets/loc-quebec.jpg";
import laval from "@/assets/loc-laval.jpg";
import yul from "@/assets/loc-yul.jpg";

const tiles = [
  { label: "Montreal", blurb: "Plateau, Griffintown, Downtown", img: montreal, to: exploreUrl({ location: "Montreal" }), span: "md:col-span-2 md:row-span-2" },
  { label: "Quebec City", blurb: "Old Quebec & Sainte-Foy", img: quebec, to: exploreUrl({ location: "Quebec City" }), span: "" },
  { label: "YUL Airport", blurb: "Curb-side pickup", img: yul, to: exploreUrl({ location: "YUL Airport", airport: true }), span: "" },
  { label: "Laval", blurb: "Family SUVs & vans", img: laval, to: exploreUrl({ location: "Laval" }), span: "md:col-span-2" },
];

export function DestinationTiles() {
  return (
    <section className="container py-12 md:py-20">
      <div className="flex items-end justify-between gap-4 mb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Destinations</p>
          <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">Where are you driving?</h2>
        </div>
        <Link to="/explore" className="text-sm font-medium text-primary hover:underline shrink-0">
          All locations
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 md:grid-rows-2 gap-4 md:auto-rows-[190px]">
        {tiles.map((t) => (
          <Link
            key={t.label}
            to={t.to}
            className={`group relative overflow-hidden rounded-2xl min-h-[190px] ${t.span}`}
          >
            <img
              src={t.img}
              alt={`Rent a car in ${t.label}`}
              loading="lazy"
              decoding="async"
              width={1200}
              height={900}
              className="absolute inset-0 h-full w-full object-cover motion-safe:transition-transform motion-safe:duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-overlay/85 via-overlay/25 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-5">
              <h3 className="text-lg md:text-xl font-bold text-overlay-foreground">{t.label}</h3>
              <p className="text-xs md:text-sm text-overlay-muted">{t.blurb}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
