import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalendarDays, MapPin, Search, Mic, MicOff, Sparkles, X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useVoiceSearch } from "@/hooks/use-voice-search";
import { exploreUrl, parseNaturalQuery, SearchState } from "@/lib/search-state";

const quickChips: Array<{ label: string; state: SearchState }> = [
  { label: "Montreal", state: { location: "Montreal" } },
  { label: "Quebec City", state: { location: "Quebec City" } },
  { label: "Laval", state: { location: "Laval" } },
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

export function SmartSearchConsole({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"classic" | "smart">("classic");
  const [location, setLocation] = useState("");
  const [smartQuery, setSmartQuery] = useState("");
  const [parsed, setParsed] = useState<string[]>([]);
  const [notUnderstood, setNotUnderstood] = useState(false);
  const [start, setStart] = useState<Date | undefined>();
  const [end, setEnd] = useState<Date | undefined>();
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [exampleIndex, setExampleIndex] = useState(0);

  useEffect(() => {
    if (mode !== "smart") return;
    const t = setInterval(() => setExampleIndex((i) => (i + 1) % examples.length), 3500);
    return () => clearInterval(t);
  }, [mode]);

  const go = (overrides?: SearchState) => {
    const state: SearchState = {
      location: overrides?.location ?? (location.trim() || undefined),
      start: start?.toISOString(),
      end: end?.toISOString(),
      ...overrides,
    };
    navigate(exploreUrl(state));
  };

  const runSmart = (raw: string) => {
    const { state, matched, understood } = parseNaturalQuery(raw);
    setParsed(matched);
    setNotUnderstood(!understood);
    if (!understood) return;
    navigate(exploreUrl({ ...state, start: state.start ?? start?.toISOString(), end: state.end ?? end?.toISOString() }));
  };

  const voice = useVoiceSearch((transcript) => {
    setMode("smart");
    setSmartQuery(transcript);
    runSmart(transcript);
  });

  return (
    <div className="w-full">
      {/* Mode switch */}
      <div className="flex items-center gap-1 mb-3 p-1 rounded-full bg-card/70 border border-border w-fit backdrop-blur">
        {(["classic", "smart"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
            className={cn(
              "px-4 py-1.5 rounded-full text-xs md:text-sm font-medium transition-colors inline-flex items-center gap-1.5",
              mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {m === "smart" && <Sparkles className="h-3.5 w-3.5" />}
            {m === "classic" ? "Search" : "Ask Rentauto"}
          </button>
        ))}
      </div>

      {mode === "classic" ? (
        <div className="rounded-2xl md:rounded-full bg-card border border-border shadow-xl shadow-primary/5 p-2 flex flex-col md:flex-row gap-2 md:gap-0 md:items-center">
          <div className="flex-1 flex items-center gap-2 px-4 py-2">
            <MapPin className="h-5 w-5 text-muted-foreground shrink-0" aria-hidden="true" />
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && go()}
              placeholder="City, airport or address"
              aria-label="Pickup location"
              className="border-0 shadow-none focus-visible:ring-0 px-0 h-9 text-base bg-transparent"
            />
          </div>

          <div className="hidden md:block w-px h-8 bg-border" aria-hidden="true" />

          <Popover open={startOpen} onOpenChange={setStartOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 px-4 py-2 text-left text-sm hover:bg-accent/40 rounded-xl md:rounded-full transition-colors"
              >
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <span className={start ? "text-foreground font-medium" : "text-muted-foreground"}>
                  {start ? format(start, "MMM d") : "Pick-up date"}
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
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>

          <div className="hidden md:block w-px h-8 bg-border" aria-hidden="true" />

          <Popover open={endOpen} onOpenChange={setEndOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 px-4 py-2 text-left text-sm hover:bg-accent/40 rounded-xl md:rounded-full transition-colors"
              >
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <span className={end ? "text-foreground font-medium" : "text-muted-foreground"}>
                  {end ? format(end, "MMM d") : "Return date"}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto p-0">
              <Calendar
                mode="single"
                selected={end}
                onSelect={(d) => { setEnd(d); setEndOpen(false); }}
                disabled={(d) => d < (start || new Date(new Date().setHours(0, 0, 0, 0)))}
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>

          <div className="flex gap-2 md:ml-2">
            <VoiceButton voice={voice} />
            <Button size="lg" onClick={() => go()} className="flex-1 rounded-xl md:rounded-full h-12 px-6 gap-2">
              <Search className="h-4 w-4" />
              Search
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-card border border-border shadow-xl shadow-primary/5 p-2">
          <div className="flex items-center gap-2 px-3 py-1">
            <Sparkles className="h-5 w-5 text-primary shrink-0" aria-hidden="true" />
            <Input
              value={smartQuery}
              onChange={(e) => { setSmartQuery(e.target.value); setNotUnderstood(false); }}
              onKeyDown={(e) => e.key === "Enter" && runSmart(smartQuery)}
              placeholder={voice.listening ? "Listening…" : `Try: “${examples[exampleIndex]}”`}
              aria-label="Describe the car you need"
              className="border-0 shadow-none focus-visible:ring-0 px-0 h-11 text-base bg-transparent"
            />
            {smartQuery && (
              <button
                type="button"
                onClick={() => { setSmartQuery(""); setParsed([]); setNotUnderstood(false); }}
                aria-label="Clear search"
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <VoiceButton voice={voice} />
            <Button onClick={() => runSmart(smartQuery)} className="rounded-full h-11 px-5 gap-2">
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline">Find cars</span>
            </Button>
          </div>

          {voice.interim && (
            <p className="px-4 pb-2 text-sm text-muted-foreground italic">{voice.interim}</p>
          )}
          {parsed.length > 0 && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5">
              {parsed.map((p) => (
                <span key={p} className="text-xs px-2.5 py-1 rounded-full bg-accent text-accent-foreground">
                  {p}
                </span>
              ))}
            </div>
          )}
          {notUnderstood && (
            <p className="px-4 pb-2 text-sm text-muted-foreground">
              Try searching by city, dates, or vehicle type.
            </p>
          )}
        </div>
      )}

      {(voice.error || (!voice.supported && mode === "smart")) && (
        <p role="status" className="mt-2 text-xs text-muted-foreground">
          {voice.error ?? "Voice search isn't available in this browser — type your search instead."}
        </p>
      )}

      {!compact && (
        <div className="mt-4 flex flex-wrap gap-2">
          {quickChips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => go(chip.state)}
              className="text-xs md:text-sm px-3 py-1.5 rounded-full bg-card border border-border text-foreground hover:border-primary/50 hover:text-primary hover:-translate-y-0.5 transition-all"
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
        className="h-11 w-11 rounded-full shrink-0"
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
        className={cn(
          "h-11 w-11 rounded-full shrink-0 relative",
          voice.listening && "motion-safe:animate-pulse"
        )}
      >
        <Mic className="h-4 w-4" />
      </Button>
      <span className="sr-only" role="status" aria-live="polite">
        {voice.listening ? "Listening" : voice.error ? "Voice search stopped" : ""}
      </span>
    </>
  );
}
