import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalendarDays, MapPin, Search } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const quickChips = [
  { label: "Montreal", location: "Montreal" },
  { label: "Quebec City", location: "Quebec City" },
  { label: "Laval", location: "Laval" },
  { label: "YUL Airport", location: "YUL Airport" },
  { label: "Monthly", category: "Monthly" },
  { label: "Electric", category: "Electric" },
];

export function HeroSearch() {
  const navigate = useNavigate();
  const [location, setLocation] = useState("");
  const [start, setStart] = useState<Date | undefined>();
  const [end, setEnd] = useState<Date | undefined>();
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);

  const submit = (overrides?: { location?: string; category?: string }) => {
    const params = new URLSearchParams();
    const loc = overrides?.location ?? location.trim();
    if (loc) params.set("location", loc);
    if (start) params.set("start", start.toISOString());
    if (end) params.set("end", end.toISOString());
    if (overrides?.category) params.set("category", overrides.category);
    navigate(`/explore${params.toString() ? `?${params.toString()}` : ""}`);
  };

  return (
    <div className="w-full">
      <div className="rounded-2xl md:rounded-full bg-card border border-border shadow-xl shadow-primary/5 p-2 flex flex-col md:flex-row gap-2 md:gap-0 md:items-center">
        <div className="flex-1 flex items-center gap-2 px-4 py-2">
          <MapPin className="h-5 w-5 text-muted-foreground shrink-0" aria-hidden="true" />
          <Input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
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

        <Button
          size="lg"
          onClick={() => submit()}
          className="md:ml-2 rounded-xl md:rounded-full h-12 md:h-12 px-6 gap-2"
        >
          <Search className="h-4 w-4" />
          Search
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {quickChips.map((chip) => (
          <button
            key={chip.label}
            type="button"
            onClick={() => submit({ location: chip.location, category: chip.category })}
            className="text-xs md:text-sm px-3 py-1.5 rounded-full bg-card border border-border text-foreground hover:border-primary/50 hover:text-primary transition-colors"
          >
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  );
}
