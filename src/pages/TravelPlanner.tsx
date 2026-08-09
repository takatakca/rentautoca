import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { format, addDays, differenceInCalendarDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useConciergeActions } from "@/hooks/use-concierge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Loader2,
  MapPinned,
  Users,
  Wallet,
} from "lucide-react";

const TRIP_TYPES = [
  { key: "Road trip", hint: "Long highway stretches" },
  { key: "Ski weekend", hint: "Winter tires, roof space" },
  { key: "Airport pickup", hint: "YUL, YQB, YHU" },
  { key: "Family visit", hint: "Comfort and seats" },
  { key: "City break", hint: "Compact and easy parking" },
  { key: "Moving day", hint: "Cargo space" },
];

const STEPS = ["Route", "Dates", "Travellers", "Details"] as const;

export default function TravelPlanner() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { createThread } = useConciergeActions();

  const [step, setStep] = useState(0);
  const [origin, setOrigin] = useState("Montreal, QC");
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState(format(addDays(new Date(), 7), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(addDays(new Date(), 10), "yyyy-MM-dd"));
  const [passengers, setPassengers] = useState(2);
  const [budget, setBudget] = useState("");
  const [vibes, setVibes] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const days = useMemo(() => {
    const d = differenceInCalendarDays(new Date(endDate), new Date(startDate));
    return Number.isFinite(d) && d > 0 ? d : 0;
  }, [startDate, endDate]);

  const toggleVibe = (v: string) =>
    setVibes((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));

  const canAdvance =
    step === 0 ? origin.trim().length > 1 : step === 1 ? days > 0 : step === 2 ? passengers > 0 : true;

  const buildPrompt = () =>
    [
      `Plan my trip from ${origin}${destination ? ` to ${destination}` : ""}, ${startDate} to ${endDate}, ${passengers} passenger(s).`,
      budget ? `Budget: about $${budget} CAD per day.` : "",
      vibes.length ? `Trip type: ${vibes.join(", ")}.` : "",
      notes ? `Notes: ${notes}` : "",
      "Recommend 2-3 real vehicles from inventory with an exact quote for the best one, suggest a protection plan, and give pickup timing advice.",
    ]
      .filter(Boolean)
      .join(" ");

  const submit = async () => {
    if (!user) {
      navigate("/login?redirect=/travel-planner");
      return;
    }
    setSubmitting(true);
    const prompt = buildPrompt();
    try {
      const threadId = await createThread(`${origin} → ${destination || "anywhere"}`);
      const { error } = await supabase.from("travel_itineraries").insert({
        user_id: user.id,
        label: `${origin} → ${destination || "anywhere"}`,
        origin,
        departure_at: new Date(`${startDate}T12:00:00`).toISOString(),
        arrival_at: new Date(`${endDate}T12:00:00`).toISOString(),
        passengers,
        preferences: {
          destination: destination || null,
          budget_per_day_cad: budget ? Number(budget) : null,
          vibes,
          notes,
          thread_id: threadId,
        },
      });
      if (error) console.error("itinerary save failed", error.message);
      navigate(`/concierge/${threadId}?q=${encodeURIComponent(prompt)}`);
    } catch (e) {
      toast({
        title: "Could not start your plan",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh bg-background">
      <Helmet>
        <title>Trip Builder — Plan Your Drive | Rentauto.ca</title>
        <meta
          name="description"
          content="Tell Rentauto where you're going and get matched with the right vehicle, an exact price and pickup timing across Canada."
        />
      </Helmet>

      <div className="mx-auto max-w-3xl px-4 py-8">
        <header className="space-y-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
            <MapPinned className="h-3.5 w-3.5" /> Trip builder
          </span>
          <h1 className="text-3xl font-bold tracking-tight">Plan the drive, we'll find the car</h1>
        </header>

        {/* Progress */}
        <ol className="mt-6 flex items-center gap-2" aria-label="Progress">
          {STEPS.map((s, i) => (
            <li key={s} className="flex flex-1 items-center gap-2">
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                  i < step
                    ? "border-primary bg-primary text-primary-foreground"
                    : i === step
                      ? "border-primary text-primary"
                      : "border-border text-muted-foreground",
                )}
              >
                {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span
                className={cn(
                  "hidden text-xs font-medium sm:inline",
                  i === step ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {s}
              </span>
              {i < STEPS.length - 1 && <span className="h-px flex-1 bg-border" />}
            </li>
          ))}
        </ol>

        <div className="mt-6 grid gap-6 md:grid-cols-[1fr_260px]">
          <div className="rounded-2xl border border-border bg-card p-5">
            {step === 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Where are you going?</h2>
                <div className="space-y-1.5">
                  <Label htmlFor="origin">Picking up in</Label>
                  <Input id="origin" value={origin} onChange={(e) => setOrigin(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="destination">Heading to (optional)</Label>
                  <Input
                    id="destination"
                    placeholder="Quebec City, Mont-Tremblant…"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                  />
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">When?</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="start">Pickup date</Label>
                    <Input id="start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="end">Return date</Label>
                    <Input id="end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {days > 0 ? `${days} day${days === 1 ? "" : "s"} of rental.` : "Return date must be after pickup."}
                </p>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Who's travelling?</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="pax">Passengers</Label>
                    <Input
                      id="pax"
                      type="number"
                      min={1}
                      max={9}
                      value={passengers}
                      onChange={(e) => setPassengers(Number(e.target.value) || 1)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="budget">Budget per day (CAD)</Label>
                    <Input
                      id="budget"
                      type="number"
                      min={0}
                      placeholder="Optional"
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">What kind of trip?</h2>
                <div className="grid gap-2 sm:grid-cols-2">
                  {TRIP_TYPES.map((t) => {
                    const active = vibes.includes(t.key);
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => toggleVibe(t.key)}
                        aria-pressed={active}
                        className={cn(
                          "rounded-xl border p-3 text-left transition-colors",
                          active ? "border-primary bg-primary/10" : "border-border hover:bg-secondary/60",
                        )}
                      >
                        <span className="text-sm font-medium">{t.key}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">{t.hint}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="notes">Anything else?</Label>
                  <Textarea
                    id="notes"
                    rows={3}
                    placeholder="Winter tires, roof box, dog-friendly, child seat…"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="mt-6 flex items-center gap-2">
              {step > 0 && (
                <Button variant="outline" className="rounded-xl" onClick={() => setStep((s) => s - 1)}>
                  <ArrowLeft className="mr-1 h-4 w-4" /> Back
                </Button>
              )}
              {step < STEPS.length - 1 ? (
                <Button
                  className="ml-auto rounded-xl"
                  disabled={!canAdvance}
                  onClick={() => setStep((s) => s + 1)}
                >
                  Continue <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              ) : (
                <Button className="ml-auto rounded-xl" disabled={submitting} onClick={submit}>
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Build my trip plan
                </Button>
              )}
            </div>
          </div>

          {/* Summary */}
          <aside className="h-fit rounded-2xl border border-border bg-secondary/30 p-4 md:sticky md:top-24">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Your trip
            </h2>
            <dl className="mt-3 space-y-2.5 text-sm">
              <div className="flex items-start gap-2">
                <MapPinned className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span>
                  {origin || "—"}
                  {destination ? ` → ${destination}` : ""}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span>
                  {startDate} → {endDate}
                  {days > 0 ? ` · ${days}d` : ""}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <Users className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span>{passengers} passenger{passengers === 1 ? "" : "s"}</span>
              </div>
              {budget && (
                <div className="flex items-start gap-2">
                  <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span>Up to ${budget}/day</span>
                </div>
              )}
              {vibes.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {vibes.map((v) => (
                    <span key={v} className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px]">
                      {v}
                    </span>
                  ))}
                </div>
              )}
            </dl>
            <p className="mt-4 text-xs leading-snug text-muted-foreground">
              We check live availability and price with the same engine used at checkout.
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}
