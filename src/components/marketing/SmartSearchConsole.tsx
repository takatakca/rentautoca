import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CalendarDays,
  Clock3,
  MapPin,
  Mic,
  MicOff,
  Navigation,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useVoiceSearch } from "@/hooks/use-voice-search";
import { useNearbyLocation } from "@/hooks/use-nearby-location";
import { exploreUrl, parseNaturalQuery, SearchState } from "@/lib/search-state";

const quickChips: Array<
  | { label: string; state: SearchState }
  | { label: string; query: string }
> = [
  { label: "This weekend", query: "this weekend" },
  { label: "YUL Airport", state: { location: "YUL Airport", airport: true, category: "Airports" } },
  { label: "Monthly", state: { monthly: true, category: "Monthly" } },
  { label: "Electric", state: { electric: true, category: "Electric" } },
];

const examples = [
  "SUV in Montreal this weekend",
  "Electric car near YUL tomorrow",
  "7-seat car from Friday to Monday",
  "Cheapest car in Laval",
];

function nowWindow() {
  const start = new Date();
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function SmartSearchConsole({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"now" | "plan" | "smart">("now");
  const [location, setLocation] = useState("");
  const [smartQuery, setSmartQuery] = useState("");
  const [parsed, setParsed] = useState<string[]>([]);
  const [notUnderstood, setNotUnderstood] = useState(false);
  const [start, setStart] = useState<Date | undefined>();
  const [end, setEnd] = useState<Date | undefined>();
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [exampleIndex, setExampleIndex] = useState(0);
  const [pendingNearby, setPendingNearby] = useState(false);
  const { coords, status: geoStatus, request: requestGeo } = useNearbyLocation();

  useEffect(() => {
    if (mode !== "smart") return;
    const t = setInterval(() => setExampleIndex((i) => (i + 1) % examples.length), 3500);
    return () => clearInterval(t);
  }, [mode]);

  useEffect(() => {
    if (!pendingNearby) return;

    if (coords) {
      const window = nowWindow();
      setPendingNearby(false);
      navigate(
        exploreUrl({
          lat: coords.lat,
          lng: coords.lng,
          start: window.start,
          end: window.end,
          instantBook: true,
        }),
      );
      return;
    }

    if (geoStatus === "denied" || geoStatus === "unsupported") {
      setPendingNearby(false);
    }
  }, [coords, geoStatus, navigate, pendingNearby]);

  const go = (overrides?: SearchState) => {
    const state: SearchState = {
      location: overrides?.location ?? (location.trim() || undefined),
      start: start?.toISOString(),
      end: end?.toISOString(),
      ...overrides,
    };
    navigate(exploreUrl(state));
  };

  const goNow = (overrides?: SearchState) => {
    const window = nowWindow();
    navigate(
      exploreUrl({
        location: overrides?.location ?? (location.trim() || undefined),
        start: window.start,
        end: window.end,
        instantBook: true,
        ...overrides,
      }),
    );
  };

  const findNearMeNow = () => {
    if (coords) {
      const window = nowWindow();
      navigate(
        exploreUrl({
          lat: coords.lat,
          lng: coords.lng,
          start: window.start,
          end: window.end,
          instantBook: true,
        }),
      );
      return;
    }
    setPendingNearby(true);
    requestGeo();
  };

  const runSmart = (raw: string) => {
    const { state, matched, understood } = parseNaturalQuery(raw);
    setParsed(matched);
    setNotUnderstood(!understood);
    if (!understood) return;
    navigate(
      exploreUrl({
        ...state,
        start: state.start ?? start?.toISOString(),
        end: state.end ?? end?.toISOString(),
      }),
    );
  };

  const voice = useVoiceSearch((transcript) => {
    setMode("smart");
    setSmartQuery(transcript);
    runSmart(transcript);
  });

  return (
    <div className="w-full">
      <div className="mb-3 flex w-fit items-center gap-1 rounded-full border border-white/15 bg-black/25 p-1 text-white backdrop-blur-xl">
        {([
          ["now", "Drive now"],
          ["plan", "Plan a trip"],
          ["smart", "Ask Rentauto"],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            aria-pressed={mode === value}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-all md:text-sm",
              mode === value
                ? "bg-white text-slate-950 shadow-sm"
                : "text-white/70 hover:text-white",
            )}
          >
            {value === "now" && <Clock3 className="h-3.5 w-3.5" />}
            {value === "smart" && <Sparkles className="h-3.5 w-3.5" />}
            {label}
          </button>
        ))}
      </div>

      {mode === "now" && (
        <div className="overflow-hidden rounded-[1.75rem] border border-white/20 bg-card shadow-2xl shadow-black/20">
          <div className="grid gap-0 md:grid-cols-[1.1fr_0.9fr]">
            <div className="p-5 md:p-6">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Ready when you are</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">Get a car moving fast.</h2>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                Show vehicles available for the next 24 hours, with instant-book options first.
              </p>

              <Button
                size="lg"
                onClick={findNearMeNow}
                disabled={geoStatus === "asking" || pendingNearby}
                className="mt-5 h-14 w-full justify-between rounded-2xl px-5 text-base md:w-auto md:min-w-72"
              >
                <span className="inline-flex items-center gap-2">
                  <Navigation className="h-5 w-5" />
                  {geoStatus === "asking" || pendingNearby ? "Finding nearby cars…" : "Find a car near me"}
                </span>
                <span aria-hidden>→</span>
              </Button>

              {geoStatus === "denied" && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Location is off. Type a city or airport instead.
                </p>
              )}
            </div>

            <div className="border-t border-border bg-secondary/45 p-5 md:border-l md:border-t-0 md:p-6">
              <p className="text-sm font-semibold">Or tell us where</p>
              <div className="mt-3 flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && location.trim() && goNow()}
                    placeholder="City or airport"
                    aria-label="Pickup city or airport"
                    className="h-12 rounded-xl bg-background pl-9"
                  />
                </div>
                <Button
                  size="lg"
                  variant="secondary"
                  onClick={() => goNow()}
                  disabled={!location.trim()}
                  className="h-12 rounded-xl px-4"
                  aria-label="Find cars at this location"
                >
                  <Search className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                No driver service. You book the vehicle, verify your trip, pick it up, drive, and return it.
              </p>
            </div>
          </div>
        </div>
      )}

      {mode === "plan" && (
        <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-2 shadow-xl shadow-black/10 md:flex-row md:items-center md:gap-0 md:rounded-full">
          <div className="flex flex-1 items-center gap-2 px-4 py-2">
            <MapPin className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && go()}
              placeholder="City, airport or address"
              aria-label="Pickup location"
              className="h-9 border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0"
            />
          </div>

          <div className="hidden h-8 w-px bg-border md:block" aria-hidden="true" />

          <Popover open={startOpen} onOpenChange={setStartOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 rounded-xl px-4 py-2 text-left text-sm transition-colors hover:bg-accent/40 md:rounded-full"
              >
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <span className={start ? "font-medium text-foreground" : "text-muted-foreground"}>
                  {start ? format(start, "MMM d") : "Pick-up"}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-0">
              <Calendar
                mode="single"
                selected={start}
                onSelect={(d) => {
                  setStart(d);
                  if (d && end && end <= d) setEnd(undefined);
                  setStartOpen(false);
                }}
                disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                className="pointer-events-auto p-3"
              />
            </PopoverContent>
          </Popover>

          <div className="hidden h-8 w-px bg-border md:block" aria-hidden="true" />

          <Popover open={endOpen} onOpenChange={setEndOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 rounded-xl px-4 py-2 text-left text-sm transition-colors hover:bg-accent/40 md:rounded-full"
              >
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <span className={end ? "font-medium text-foreground" : "text-muted-foreground"}>
                  {end ? format(end, "MMM d") : "Return"}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto p-0">
              <Calendar
                mode="single"
                selected={end}
                onSelect={(d) => {
                  setEnd(d);
                  setEndOpen(false);
                }}
                disabled={(d) => d < (start || new Date(new Date().setHours(0, 0, 0, 0)))}
                className="pointer-events-auto p-3"
              />
            </PopoverContent>
          </Popover>

          <div className="flex gap-2 md:ml-2">
            <VoiceButton voice={voice} />
            <Button size="lg" onClick={() => go()} className="h-12 flex-1 gap-2 rounded-xl px-6 md:rounded-full">
              <Search className="h-4 w-4" />
              Search
            </Button>
          </div>
        </div>
      )}

      {mode === "smart" && (
        <div className="rounded-2xl border border-border bg-card p-2 shadow-xl shadow-black/10">
          <div className="flex items-center gap-2 px-3 py-1">
            <Sparkles className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <Input
              value={smartQuery}
              onChange={(e) => {
                setSmartQuery(e.target.value);
                setNotUnderstood(false);
              }}
              onKeyDown={(e) => e.key === "Enter" && runSmart(smartQuery)}
              placeholder={voice.listening ? "Listening…" : `Try: “${examples[exampleIndex]}”`}
              aria-label="Describe the car you need"
              className="h-11 border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0"
            />
            {smartQuery && (
              <button
                type="button"
                onClick={() => {
                  setSmartQuery("");
                  setParsed([]);
                  setNotUnderstood(false);
                }}
                aria-label="Clear search"
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <VoiceButton voice={voice} />
            <Button onClick={() => runSmart(smartQuery)} className="h-11 rounded-full px-5">
              <Search className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Find cars</span>
            </Button>
          </div>

          {voice.interim && <p className="px-4 pb-2 text-sm italic text-muted-foreground">{voice.interim}</p>}
          {parsed.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-4 pb-2">
              {parsed.map((p) => (
                <span key={p} className="rounded-full bg-accent px-2.5 py-1 text-xs text-accent-foreground">
                  {p}
                </span>
              ))}
            </div>
          )}
          {notUnderstood && (
            <p className="px-4 pb-2 text-sm text-muted-foreground">
              Try a city, dates, number of seats, budget, airport, or vehicle type.
            </p>
          )}
        </div>
      )}

      {(voice.error || (!voice.supported && mode === "smart")) && (
        <p role="status" className="mt-2 text-xs text-overlay-muted">
          {voice.error ?? "Voice search isn't available in this browser — type your search instead."}
        </p>
      )}

      {!compact && (
        <div className="mt-4 flex flex-wrap gap-2">
          {quickChips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => ("query" in chip ? runSmart(chip.query) : go(chip.state))}
              className="rounded-full border border-white/15 bg-black/25 px-3 py-1.5 text-xs font-medium text-white backdrop-blur transition hover:-translate-y-0.5 hover:bg-black/40 md:text-sm"
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function VoiceButton({ voice }: { voice: ReturnType<typeof useVoiceSearch> }) {
  if (!voice.supported) {
    return (
      <Button
        type="button"
        variant="outline"
        size="icon"
        disabled
        aria-label="Voice search unavailable in this browser"
        title="Voice search unavailable in this browser"
        className="h-11 w-11 shrink-0 rounded-full"
      >
        <MicOff className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant={voice.listening ? "default" : "outline"}
        size="icon"
        onClick={voice.toggle}
        aria-pressed={voice.listening}
        aria-label={voice.listening ? "Stop voice search" : "Start voice search"}
        className={cn("relative h-11 w-11 shrink-0 rounded-full", voice.listening && "motion-safe:animate-pulse")}
      >
        <Mic className="h-4 w-4" />
      </Button>
      <span className="sr-only" role="status" aria-live="polite">
        {voice.listening ? "Listening" : voice.error ? "Voice search stopped" : ""}
      </span>
    </>
  );
}
