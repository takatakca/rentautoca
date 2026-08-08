import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { format, addDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useConciergeActions } from "@/hooks/use-concierge";
import { useToast } from "@/hooks/use-toast";
import { Map, Loader2, Sparkles } from "lucide-react";

const VIBES = ["Road trip", "Ski weekend", "Airport pickup", "Family visit", "City break", "Moving day"];

export default function TravelPlanner() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { createThread } = useConciergeActions();

  const [origin, setOrigin] = useState("Montreal, QC");
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState(format(addDays(new Date(), 7), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(addDays(new Date(), 10), "yyyy-MM-dd"));
  const [passengers, setPassengers] = useState(2);
  const [budget, setBudget] = useState("");
  const [vibes, setVibes] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const toggleVibe = (v: string) =>
    setVibes((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));

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
        thread_id: threadId,
        origin,
        destination: destination || null,
        start_date: startDate,
        end_date: endDate,
        passengers,
        preferences: { budget_per_day_cad: budget ? Number(budget) : null, vibes, notes },
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
        <title>Travel Planner — Plan Your Trip | Rentauto.ca</title>
        <meta
          name="description"
          content="Tell Rentauto where you're going and our AI planner matches you with the right vehicle, an exact price and pickup timing across Canada."
        />
      </Helmet>

      <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
        <header className="space-y-2">
          <div className="flex items-center gap-2 text-primary">
            <Map className="h-5 w-5" />
            <span className="text-sm font-semibold uppercase tracking-wide">Travel planner</span>
          </div>
          <h1 className="text-3xl font-bold">Plan the drive, we'll find the car</h1>
          <p className="text-muted-foreground text-sm">
            A few details and the concierge builds a plan with real vehicles and real prices.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="origin">Starting from</Label>
            <Input id="origin" value={origin} onChange={(e) => setOrigin(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="destination">Going to</Label>
            <Input
              id="destination"
              placeholder="Quebec City, Mont-Tremblant…"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="start">Pickup date</Label>
            <Input id="start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="end">Return date</Label>
            <Input id="end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
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

        <div className="space-y-2">
          <Label>Trip type</Label>
          <div className="flex flex-wrap gap-2">
            {VIBES.map((v) => (
              <Badge
                key={v}
                variant={vibes.includes(v) ? "default" : "outline"}
                onClick={() => toggleVibe(v)}
                className="cursor-pointer rounded-full px-3 py-1.5"
              >
                {v}
              </Badge>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="notes">Anything else?</Label>
          <Textarea
            id="notes"
            rows={3}
            placeholder="Winter tires, roof box, dog-friendly, long highway stretches…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <Button onClick={submit} disabled={submitting} className="w-full h-12 rounded-xl">
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Sparkles className="h-4 w-4 mr-2" />
          )}
          Build my trip plan
        </Button>
      </div>
    </div>
  );
}
