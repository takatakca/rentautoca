import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

type Item = { id: string; label: string; description?: string };
type Group = { id: string; title: string; items: Item[] };

const GROUPS: Group[] = [
  {
    id: "legal",
    title: "Legal",
    items: [
      { id: "terms", label: "Terms of Service published", description: "/terms reachable and current." },
      { id: "privacy", label: "Privacy Policy published (PIPEDA + Quebec Law 25)" },
      { id: "insurance", label: "Insurance & Protection disclosure published" },
      { id: "cancellation", label: "Cancellation policy published" },
      { id: "tracking-disclosure", label: "GPS tracking disclosure visible on listing + checkout" },
    ],
  },
  {
    id: "env",
    title: "Environment",
    items: [
      { id: "vite-app-url", label: "VITE_APP_URL set to deployed domain" },
      { id: "public-app-url", label: "PUBLIC_APP_URL secret set" },
      { id: "supabase-auth-urls", label: "Supabase Auth Site URL + redirect URLs include deployed domain" },
      { id: "tracking-secret", label: "TRACKING_PROVIDER_SECRET set" },
    ],
  },
  {
    id: "stripe",
    title: "Stripe",
    items: [
      { id: "stripe-secret", label: "STRIPE_SECRET_KEY (live) set" },
      { id: "stripe-webhook-secret", label: "STRIPE_WEBHOOK_SECRET matches live endpoint" },
      { id: "stripe-webhook-events", label: "Webhook subscribed to checkout/account/dispute events" },
      { id: "stripe-test-success", label: "Test card 4242 booking → trip confirmed" },
      { id: "stripe-test-decline", label: "Test card 0002 booking → trip back to draft" },
      { id: "stripe-live-1cad", label: "Live $1 booking succeeded and was refunded" },
    ],
  },
  {
    id: "host",
    title: "Host setup",
    items: [
      { id: "host-signup", label: "Real host account created" },
      { id: "host-profile", label: "Host profile complete (photo, phone, address)" },
      { id: "host-connect", label: "Stripe Connect onboarding complete (charges + payouts enabled)" },
      { id: "host-car", label: "Real car listed with 5+ photos" },
      { id: "host-pricing", label: "Daily rate, mileage, extras, location set" },
      { id: "host-published", label: "Listing status = active" },
    ],
  },
  {
    id: "guest",
    title: "Guest setup",
    items: [
      { id: "guest-signup", label: "Real guest account created (different device)" },
      { id: "guest-profile", label: "Guest profile + ID verification complete" },
    ],
  },
  {
    id: "booking",
    title: "Booking flow",
    items: [
      { id: "search-found", label: "Car appears in /explore with correct filters" },
      { id: "favorite-works", label: "Favorite toggles and persists" },
      { id: "quote-correct", label: "Quote shows correct CAD totals incl. GST/QST" },
      { id: "checkout-success", label: "Checkout completes; trip = confirmed; availability blocked" },
    ],
  },
  {
    id: "tracking",
    title: "GPS tracking",
    items: [
      { id: "device-registered", label: "vehicle_tracking_devices row exists for real car" },
      { id: "provider-webhook", label: "Provider posts to tracking-ingest with secret header" },
      { id: "no-prepings", label: "Pings before check-in are dropped (stored: false)" },
      { id: "live-updates", label: "LiveLocationCard updates in realtime during trip" },
    ],
  },
  {
    id: "checkin",
    title: "Check-in / Check-out",
    items: [
      { id: "checkin-photos", label: "Check-in records 4+ photos + odometer + fuel" },
      { id: "checkin-active", label: "Trip flips to active; tracking session opens" },
      { id: "checkout-photos", label: "Check-out records 4+ photos + final mileage + fuel" },
      { id: "checkout-complete", label: "Trip flips to completed; tracking session closes" },
      { id: "review-submitted", label: "Guest review submitted and visible on listing" },
    ],
  },
  {
    id: "failures",
    title: "Failure paths",
    items: [
      { id: "cancel-flex", label: "Cancellation under Flexible policy: full refund" },
      { id: "cancel-strict", label: "Cancellation within 24h: partial/no refund per policy" },
      { id: "host-cancel", label: "Host cancellation: guest full refund + 20% credit" },
      { id: "incident", label: "Incident report creates trip_incidents row; admin sees it" },
      { id: "dispute", label: "Stripe dispute event logs to stripe_webhook_events" },
    ],
  },
  {
    id: "approval",
    title: "Final launch approval",
    items: [
      { id: "no-p0", label: "No P0/P1 bugs open" },
      { id: "ops-signoff", label: "Operations sign-off recorded" },
      { id: "founder-signoff", label: "Founder sign-off recorded" },
      { id: "lc1-passed", label: "LC1 PASSED — cleared for GA" },
    ],
  },
];

const STORAGE_KEY = "rentauto.lc1.checklist.v1";

type State = Record<string, { checked: boolean; note: string }>;

function loadState(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

export default function AdminLaunchChecklist() {
  const [state, setState] = useState<State>(() => loadState());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }, [state]);

  const allItems = useMemo(() => GROUPS.flatMap((g) => g.items), []);
  const checkedCount = allItems.filter((i) => state[i.id]?.checked).length;
  const pct = Math.round((checkedCount / allItems.length) * 100);

  const update = (id: string, patch: Partial<{ checked: boolean; note: string }>) =>
    setState((s) => ({ ...s, [id]: { checked: false, note: "", ...s[id], ...patch } }));

  const reset = () => {
    if (confirm("Reset all LC1 checklist items?")) setState({});
  };

  return (
    <div className="container py-8 pb-24 md:pb-8 max-w-4xl">
      <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to Admin
      </Link>

      <div className="flex flex-col gap-3 mb-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold">Launch Candidate 1 (LC1)</h1>
            <p className="text-muted-foreground text-sm">
              End-to-end real-world validation checklist. Stored locally in this browser.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={pct === 100 ? "default" : "outline"} className="text-base px-3 py-1">
              {checkedCount}/{allItems.length}
            </Badge>
            <Button variant="ghost" size="sm" onClick={reset}>Reset</Button>
          </div>
        </div>
        <Progress value={pct} />
        {pct === 100 && (
          <div className="flex items-center gap-2 text-sm text-primary">
            <CheckCircle2 className="h-4 w-4" /> All items complete — LC1 ready for sign-off.
          </div>
        )}
      </div>

      <div className="space-y-4">
        {GROUPS.map((group) => {
          const done = group.items.filter((i) => state[i.id]?.checked).length;
          return (
            <Card key={group.id}>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-lg">{group.title}</CardTitle>
                  <CardDescription>
                    {done}/{group.items.length} complete
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {group.items.map((item) => {
                  const row = state[item.id] || { checked: false, note: "" };
                  return (
                    <div key={item.id} className="flex flex-col gap-2 border-b border-border pb-3 last:border-0 last:pb-0">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <Checkbox
                          checked={row.checked}
                          onCheckedChange={(v) => update(item.id, { checked: !!v })}
                          className="mt-0.5"
                        />
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${row.checked ? "line-through text-muted-foreground" : ""}`}>
                            {item.label}
                          </p>
                          {item.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                          )}
                        </div>
                      </label>
                      <Textarea
                        placeholder="Notes (optional)"
                        value={row.note}
                        onChange={(e) => update(item.id, { note: e.target.value })}
                        rows={1}
                        className="text-xs min-h-[36px] resize-y"
                      />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
