import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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
      { id: "takatak-sms-otp", label: "TAKATAK phone auth + SMS provider enabled and real OTP received" },
      { id: "takatak-master-identity", label: "Verified phone creates one TAKATAK master identity and Rentauto source profile" },
      { id: "tracking-secret", label: "RENTAUTO_TRACKING_PROVIDER_SECRET set" },
    ],
  },
  {
    id: "stripe",
    title: "Stripe",
    items: [
      { id: "stripe-secret", label: "STRIPE_SECRET_KEY (live) set" },
      { id: "stripe-webhook-secret", label: "STRIPE_WEBHOOK_SECRET matches live endpoint" },
      { id: "stripe-webhook-events", label: "Webhook subscribed to checkout/account/refund/dispute events" },
      { id: "stripe-test-success", label: "Test card 4242 booking → trip confirmed" },
      { id: "stripe-test-decline", label: "Declined/failed checkout → trip cancelled/failed and hold released" },
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
      { id: "cancel-auto", label: "Guest cancellation inside saved auto-refund rule → Stripe refund succeeds" },
      { id: "cancel-review", label: "Guest cancellation outside explicit rule → manual review; booking stays reserved" },
      { id: "host-cancel", label: "Host cancellation of paid booking → full Stripe refund" },
      { id: "refund-failure", label: "Failed/pending refund remains blocked and visible in admin cancellation queue" },
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

type State = Record<string, { checked: boolean; note: string }>;

type ReadinessEvidence = {
  ready: boolean;
  detail: string;
};

type ReadinessPayload = {
  generated_at: string;
  counts: Record<string, number>;
  evidence: Record<string, ReadinessEvidence>;
};

export default function AdminLaunchChecklist() {
  const [state, setState] = useState<State>({});
  const [loading, setLoading] = useState(true);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [readiness, setReadiness] = useState<ReadinessPayload | null>(null);
  const [readinessError, setReadinessError] = useState("");
  const [readinessLoading, setReadinessLoading] = useState(true);

  const allItems = useMemo(() => GROUPS.flatMap((g) => g.items), []);
  const checkedCount = allItems.filter((i) => state[i.id]?.checked).length;
  const pct = Math.round((checkedCount / allItems.length) * 100);
  const readinessEntries = Object.values(readiness?.evidence ?? {});
  const readinessReadyCount = readinessEntries.filter((item) => item.ready).length;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [checklistResult, readinessResult] = await Promise.all([
        supabase
          .from("launch_checklist_items")
          .select("item_id,checked,note"),
        supabase.functions.invoke("rentauto-admin-launch-readiness", {
          body: {},
        }),
      ]);

      if (cancelled) return;

      if (checklistResult.error) {
        setError("Could not load the shared LC1 checklist.");
      } else {
        const next: State = {};
        for (const row of checklistResult.data ?? []) {
          next[row.item_id] = {
            checked: row.checked,
            note: row.note,
          };
        }
        setState(next);
      }

      if (readinessResult.error) {
        setReadinessError("Could not load automated technical evidence.");
      } else if (readinessResult.data) {
        setReadiness(readinessResult.data as ReadinessPayload);
      }

      setLoading(false);
      setReadinessLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const updateDraft = (
    id: string,
    patch: Partial<{ checked: boolean; note: string }>,
  ) => {
    setState((current) => ({
      ...current,
      [id]: {
        checked: false,
        note: "",
        ...current[id],
        ...patch,
      },
    }));
  };

  const persist = async (
    id: string,
    next: { checked: boolean; note: string },
  ) => {
    const previous = state[id] ?? { checked: false, note: "" };
    setError("");
    setState((current) => ({ ...current, [id]: next }));
    setSavingIds((current) => new Set(current).add(id));

    const { error: saveError } = await supabase
      .from("launch_checklist_items")
      .upsert(
        {
          item_id: id,
          checked: next.checked,
          note: next.note,
        },
        { onConflict: "item_id" },
      );

    if (saveError) {
      setState((current) => ({ ...current, [id]: previous }));
      setError("Could not save this LC1 item. The server state was not changed.");
    }

    setSavingIds((current) => {
      const nextSaving = new Set(current);
      nextSaving.delete(id);
      return nextSaving;
    });
  };

  const reset = async () => {
    if (!confirm("Reset all LC1 checklist items for every admin?")) return;

    const previous = state;
    const cleared: State = Object.fromEntries(
      allItems.map((item) => [item.id, { checked: false, note: "" }]),
    );

    setError("");
    setState(cleared);
    setSavingIds(new Set(allItems.map((item) => item.id)));

    const { error: resetError } = await supabase
      .from("launch_checklist_items")
      .upsert(
        allItems.map((item) => ({
          item_id: item.id,
          checked: false,
          note: "",
        })),
        { onConflict: "item_id" },
      );

    if (resetError) {
      setState(previous);
      setError("Could not reset LC1. The shared server state was not changed.");
    }

    setSavingIds(new Set());
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
              Shared server checklist. Admin changes are timestamped and audit logged.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={pct === 100 ? "default" : "outline"} className="text-base px-3 py-1">
              {checkedCount}/{allItems.length}
            </Badge>
            <Button variant="ghost" size="sm" onClick={() => void reset()} disabled={loading || savingIds.size > 0}>
              Reset
            </Button>
          </div>
        </div>
        <Progress value={pct} />
        <div className="rounded-xl border bg-muted/30 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">Automated technical evidence</p>
              <p className="text-xs text-muted-foreground">
                Evidence never checks a launch item automatically. Human sign-off stays manual.
              </p>
            </div>
            <Badge variant={readinessReadyCount === readinessEntries.length && readinessEntries.length > 0 ? "default" : "outline"}>
              {readinessReadyCount}/{readinessEntries.length || 0} evidence signals
            </Badge>
          </div>
          {readiness?.generated_at && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Refreshed {new Date(readiness.generated_at).toLocaleString()}
            </p>
          )}
          {readinessLoading && (
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading technical evidence…
            </div>
          )}
          {readinessError && <p className="mt-2 text-xs text-destructive">{readinessError}</p>}
        </div>
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading shared LC1 state…
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {pct === 100 && !loading && (
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
                  const saving = savingIds.has(item.id);
                  const technicalEvidence = readiness?.evidence[item.id];

                  return (
                    <div key={item.id} className="flex flex-col gap-2 border-b border-border pb-3 last:border-0 last:pb-0">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <Checkbox
                          checked={row.checked}
                          onCheckedChange={(value) =>
                            void persist(item.id, { checked: !!value, note: row.note })
                          }
                          disabled={loading || saving}
                          className="mt-0.5"
                        />
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${row.checked ? "line-through text-muted-foreground" : ""}`}>
                            {item.label}
                          </p>
                          {item.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                          )}
                          {technicalEvidence && (
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <Badge variant={technicalEvidence.ready ? "default" : "outline"} className="text-[10px]">
                                {technicalEvidence.ready ? "Evidence found" : "No evidence yet"}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {technicalEvidence.detail}
                              </span>
                            </div>
                          )}
                          {saving && (
                            <p className="text-xs text-muted-foreground mt-1">Saving…</p>
                          )}
                        </div>
                      </label>
                      <Textarea
                        placeholder="Notes (optional)"
                        value={row.note}
                        onChange={(event) => updateDraft(item.id, { note: event.target.value })}
                        onBlur={(event) =>
                          void persist(item.id, {
                            checked: state[item.id]?.checked ?? row.checked,
                            note: event.currentTarget.value,
                          })
                        }
                        rows={1}
                        maxLength={4000}
                        disabled={loading || saving}
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
