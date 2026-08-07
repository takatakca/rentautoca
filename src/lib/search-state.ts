/**
 * Shared search state for Rentauto discovery (homepage <-> Explore).
 * Serializes to/from URL query params so any entry point preserves intent.
 */

export interface SearchState {
  location?: string;
  lat?: number;
  lng?: number;
  start?: string; // ISO
  end?: string; // ISO
  category?: string; // All | Airports | Monthly | Electric | Luxury | SUV | Family | Budget | Winter | Weekend
  maxPrice?: number; // dollars per day
  seats?: number;
  airport?: boolean;
  monthly?: boolean;
  electric?: boolean;
  instantBook?: boolean;
  sort?: "newest" | "price_asc" | "price_desc" | "rating";
}

export function searchStateToParams(s: SearchState): URLSearchParams {
  const p = new URLSearchParams();
  if (s.location) p.set("location", s.location);
  if (typeof s.lat === "number" && typeof s.lng === "number") {
    p.set("lat", s.lat.toFixed(4));
    p.set("lng", s.lng.toFixed(4));
  }
  if (s.start) p.set("start", s.start);
  if (s.end) p.set("end", s.end);
  if (s.category && s.category !== "All") p.set("category", s.category);
  if (s.maxPrice) p.set("maxPrice", String(s.maxPrice));
  if (s.seats) p.set("seats", String(s.seats));
  if (s.airport) p.set("airport", "1");
  if (s.monthly) p.set("monthly", "1");
  if (s.electric) p.set("electric", "1");
  if (s.instantBook) p.set("instant", "1");
  if (s.sort && s.sort !== "newest") p.set("sort", s.sort);
  return p;
}

export function paramsToSearchState(p: URLSearchParams): SearchState {
  const num = (k: string) => {
    const v = p.get(k);
    if (!v) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  return {
    location: p.get("location") || undefined,
    lat: num("lat"),
    lng: num("lng"),
    start: p.get("start") || undefined,
    end: p.get("end") || undefined,
    category: p.get("category") || undefined,
    maxPrice: num("maxPrice"),
    seats: num("seats"),
    airport: p.get("airport") === "1",
    monthly: p.get("monthly") === "1",
    electric: p.get("electric") === "1",
    instantBook: p.get("instant") === "1",
    sort: (p.get("sort") as SearchState["sort"]) || undefined,
  };
}

export function exploreUrl(s: SearchState) {
  const q = searchStateToParams(s).toString();
  return `/explore${q ? `?${q}` : ""}`;
}

/* ------------------------------------------------------------------ */
/* Deterministic natural-language parser (no AI backend required)      */
/* ------------------------------------------------------------------ */

const CITIES = [
  "montreal", "montréal", "quebec city", "québec", "laval", "longueuil",
  "gatineau", "sherbrooke", "trois-rivières", "trois-rivieres", "brossard",
  "toronto", "ottawa",
];

const AIRPORTS: Record<string, string> = {
  yul: "YUL Airport",
  trudeau: "YUL Airport",
  "montreal airport": "YUL Airport",
  yqb: "YQB Airport",
  "jean lesage": "YQB Airport",
  "quebec city airport": "YQB Airport",
};

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function titleCase(s: string) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(10, 0, 0, 0);
  return x;
}

function nextWeekday(from: Date, weekday: number) {
  const d = startOfDay(from);
  const diff = (weekday - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d;
}

export interface ParseResult {
  state: SearchState;
  matched: string[];
  understood: boolean;
}

export function parseNaturalQuery(raw: string): ParseResult {
  const q = raw.toLowerCase().trim();
  const state: SearchState = {};
  const matched: string[] = [];
  if (!q) return { state, matched, understood: false };

  const now = new Date();

  // Airport
  for (const [key, label] of Object.entries(AIRPORTS)) {
    if (q.includes(key)) {
      state.location = label;
      state.airport = true;
      state.category = "Airports";
      matched.push(label);
      break;
    }
  }
  if (!state.airport && /\bairport\b|\baéroport\b/.test(q)) {
    state.airport = true;
    state.category = "Airports";
    matched.push("Airport pickup");
  }

  // City
  if (!state.location) {
    for (const city of CITIES) {
      if (q.includes(city)) {
        state.location = titleCase(city);
        matched.push(titleCase(city));
        break;
      }
    }
  }

  // Price: "under $90", "under 1,200 dollars", "less than 90 a day"
  const priceMatch = q.match(/(?:under|below|less than|max|maximum|cheaper than)\s*\$?\s*([\d,]+)/);
  if (priceMatch) {
    const value = Number(priceMatch[1].replace(/,/g, ""));
    if (Number.isFinite(value) && value > 0) {
      if (/month/.test(q) || value >= 600) {
        state.monthly = /month/.test(q) || state.monthly;
        state.maxPrice = Math.round(value / 30);
      } else {
        state.maxPrice = value;
      }
      matched.push(`Under $${state.maxPrice}/day`);
    }
  }
  if (/\bcheapest\b|\bcheap\b|\bbudget\b|\bbest value\b/.test(q)) {
    state.sort = "price_asc";
    matched.push("Lowest price first");
  }

  // Seats
  const seatMatch = q.match(/(\d+)[\s-]*(?:seat|seater|passenger|places)/);
  if (seatMatch) {
    state.seats = Number(seatMatch[1]);
    matched.push(`${state.seats}+ seats`);
  } else if (/\bseven[\s-]?seat/.test(q)) {
    state.seats = 7;
    matched.push("7+ seats");
  } else if (/\bfamily\b|\bminivan\b/.test(q)) {
    state.seats = 5;
    matched.push("Family friendly");
  }

  // Category / fuel
  if (/\belectric\b|\bev\b|\btesla\b|\bpolestar\b/.test(q)) {
    state.electric = true;
    state.category = state.category ?? "Electric";
    matched.push("Electric");
  }
  if (/\bsuv\b|\bcrossover\b/.test(q)) {
    state.category = "SUV";
    matched.push("SUV");
  }
  if (/\bluxury\b|\bpremium car\b|\bbmw\b|\bmercedes\b|\bporsche\b|\baudi\b/.test(q)) {
    state.category = "Luxury";
    matched.push("Luxury");
  }
  if (/\bmonthly\b|\bper month\b|\bfor a month\b|\blong term\b/.test(q)) {
    state.monthly = true;
    state.category = state.category ?? "Monthly";
    matched.push("Monthly");
  }
  if (/\binstant\b|\bbook now\b|\bright away\b/.test(q)) {
    state.instantBook = true;
    matched.push("Instant book");
  }
  if (/\bwinter\b|\bsnow tire/.test(q)) {
    state.category = "Winter";
    matched.push("Winter-ready");
  }

  // Dates
  let start: Date | undefined;
  let end: Date | undefined;

  if (/\btoday\b|\bnow\b|\bright now\b/.test(q)) {
    start = startOfDay(now);
    end = new Date(start);
    end.setDate(end.getDate() + 1);
    matched.push("Today");
  } else if (/\btomorrow\b/.test(q)) {
    start = startOfDay(now);
    start.setDate(start.getDate() + 1);
    end = new Date(start);
    end.setDate(end.getDate() + 1);
    matched.push("Tomorrow");
  } else if (/\bthis weekend\b|\bweekend\b/.test(q)) {
    start = nextWeekday(now, 5); // Friday
    end = new Date(start);
    end.setDate(end.getDate() + 2);
    matched.push("This weekend");
  } else if (/\bnext week\b/.test(q)) {
    start = startOfDay(now);
    start.setDate(start.getDate() + 7);
    end = new Date(start);
    end.setDate(end.getDate() + 3);
    matched.push("Next week");
  }

  // "from friday to monday"
  const range = q.match(
    /from\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s+(?:to|until|till|through)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/
  );
  if (range) {
    start = nextWeekday(now, WEEKDAYS.indexOf(range[1]));
    end = nextWeekday(start, WEEKDAYS.indexOf(range[2]));
    matched.push(`${titleCase(range[1])} → ${titleCase(range[2])}`);
  }

  // "for 5 days"
  const days = q.match(/for\s+(\d+)\s*(?:day|days|nights?)/);
  if (days) {
    start = start ?? startOfDay(now);
    end = new Date(start);
    end.setDate(end.getDate() + Number(days[1]));
    matched.push(`${days[1]} days`);
  }

  if (start) state.start = start.toISOString();
  if (end) state.end = end.toISOString();

  // Free-text fallback: if nothing matched, treat the query as a location/model search
  if (matched.length === 0) {
    const cleaned = raw
      .replace(/\b(find|show|me|i|need|want|a|an|the|car|cars|rent|rental|please|near|in)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (cleaned.length >= 2) {
      state.location = cleaned;
      return { state, matched: [cleaned], understood: true };
    }
    return { state, matched, understood: false };
  }

  return { state, matched, understood: true };
}
