import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Banknote,
  Clock3,
  Loader2,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldAlert,
  WalletCards,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type Policy = {
  payouts_enabled: boolean;
  platform_fee_bps: number | null;
  dispute_window_hours: number | null;
  updated_at: string | null;
};

type Settlement = {
  id: string;
  trip_id: string;
  host_id: string;
  currency: string;
  rental_revenue_cents: number;
  platform_fee_bps: number | null;
  platform_fee_cents: number | null;
  host_amount_cents: number | null;
  refunded_cents: number;
  reversed_amount_cents: number;
  completed_at: string | null;
  eligible_at: string | null;
  status: string;
  hold_reason: string | null;
  stripe_transfer_id: string | null;
  transferred_at: string | null;
  reversed_at: string | null;
  last_error: string | null;
  bookingReference: string | null;
  tripStatus: string | null;
  hostName: string;
  vehicle: string;
};

type ReversalDraft = {
  amount: string;
  reason: string;
};

function money(cents: number | null, currency = "CAD") {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

function statusVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "eligible" || status === "transferred") return "default";
  if (
    status === "blocked" ||
    status === "failed" ||
    status === "reversal_required"
  ) {
    return "destructive";
  }
  if (
    status === "hold" ||
    status === "pending_trip" ||
    status === "processing" ||
    status === "reversing"
  ) {
    return "secondary";
  }
  return "outline";
}

export default function AdminSettlements() {
  const { toast } = useToast();
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [payoutsEnabled, setPayoutsEnabled] = useState(false);
  const [feePercent, setFeePercent] = useState("");
  const [windowHours, setWindowHours] = useState("");
  const [reversals, setReversals] = useState<Record<string, ReversalDraft>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke(
      "rentauto-admin-settlements",
      { body: { action: "list", status: filter } },
    );

    const response = (data ?? {}) as {
      policy?: Policy;
      settlements?: Settlement[];
      error?: string;
    };

    if (error || response.error) {
      toast({
        title: "Payout queue unavailable",
        description: response.error ?? error?.message ?? "Try again.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const nextPolicy = response.policy ?? {
      payouts_enabled: false,
      platform_fee_bps: null,
      dispute_window_hours: null,
      updated_at: null,
    };

    setPolicy(nextPolicy);
    setPayoutsEnabled(nextPolicy.payouts_enabled);
    setFeePercent(
      nextPolicy.platform_fee_bps == null
        ? ""
        : String(nextPolicy.platform_fee_bps / 100),
    );
    setWindowHours(
      nextPolicy.dispute_window_hours == null
        ? ""
        : String(nextPolicy.dispute_window_hours),
    );
    setSettlements(response.settlements ?? []);
    setLoading(false);
  }, [filter, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => {
    const result = {
      eligible: 0,
      held: 0,
      transferred: 0,
      reversalRequired: 0,
    };

    for (const settlement of settlements) {
      const amount = settlement.host_amount_cents ?? 0;
      if (settlement.status === "eligible") result.eligible += amount;
      if (
        ["hold", "blocked", "pending_trip", "configuration_required"].includes(
          settlement.status,
        )
      ) {
        result.held += amount;
      }
      if (settlement.stripe_transfer_id) {
        result.transferred += Math.max(
          0,
          amount - (settlement.reversed_amount_cents ?? 0),
        );
      }
      if (settlement.status === "reversal_required") {
        result.reversalRequired += 1;
      }
    }

    return result;
  }, [settlements]);

  const savePolicy = async () => {
    const percent = feePercent.trim() === "" ? null : Number(feePercent);
    const hours = windowHours.trim() === "" ? null : Number(windowHours);

    if (
      (percent !== null &&
        (!Number.isFinite(percent) || percent < 0 || percent > 100)) ||
      (hours !== null &&
        (!Number.isInteger(hours) || hours < 0 || hours > 720))
    ) {
      toast({
        title: "Invalid payout policy",
        description: "Fee must be 0–100% and dispute window 0–720 hours.",
        variant: "destructive",
      });
      return;
    }

    if (payoutsEnabled && (percent === null || hours === null)) {
      toast({
        title: "Policy incomplete",
        description: "Set both fee and dispute window before enabling payouts.",
        variant: "destructive",
      });
      return;
    }

    const platformFeeBps =
      percent === null ? null : Math.round(percent * 100);

    setSavingPolicy(true);
    const { data, error } = await supabase.functions.invoke(
      "rentauto-admin-settlements",
      {
        body: {
          action: "configure",
          payoutsEnabled,
          platformFeeBps,
          disputeWindowHours: hours,
        },
      },
    );
    setSavingPolicy(false);

    const response = (data ?? {}) as { ok?: boolean; error?: string };
    if (error || !response.ok) {
      toast({
        title: "Policy not saved",
        description: response.error ?? error?.message ?? "Try again.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Settlement policy updated",
      description: payoutsEnabled
        ? "Paid trips were recalculated against the active policy."
        : "Payout release remains disabled.",
    });
    await load();
  };

  const release = async (settlement: Settlement) => {
    setBusyId(settlement.id);
    const { data, error } = await supabase.functions.invoke(
      "rentauto-admin-settlements",
      {
        body: { action: "release", settlementId: settlement.id },
      },
    );
    setBusyId(null);

    const response = (data ?? {}) as {
      ok?: boolean;
      error?: string;
      transferId?: string;
    };

    if (error || !response.ok) {
      toast({
        title: "Payout not released",
        description: response.error ?? error?.message ?? "Try again.",
        variant: "destructive",
      });
      await load();
      return;
    }

    toast({
      title: "Payout released",
      description: response.transferId
        ? "Stripe transfer " + response.transferId + " was recorded."
        : "Stripe transfer was recorded.",
    });
    await load();
  };

  const refresh = async (settlement: Settlement) => {
    setBusyId(settlement.id);
    const { data, error } = await supabase.functions.invoke(
      "rentauto-admin-settlements",
      {
        body: { action: "refresh", settlementId: settlement.id },
      },
    );
    setBusyId(null);

    const response = (data ?? {}) as { ok?: boolean; error?: string };
    if (error || !response.ok) {
      toast({
        title: "Settlement not refreshed",
        description: response.error ?? error?.message ?? "Try again.",
        variant: "destructive",
      });
      return;
    }
    await load();
  };

  const reverse = async (settlement: Settlement) => {
    const draft = reversals[settlement.id] ?? { amount: "", reason: "" };
    const amount = Math.round(Number(draft.amount) * 100);

    if (
      !Number.isSafeInteger(amount) ||
      amount <= 0 ||
      draft.reason.trim().length < 5
    ) {
      toast({
        title: "Reversal details required",
        description: "Enter a positive CAD amount and a clear reason.",
        variant: "destructive",
      });
      return;
    }

    setBusyId(settlement.id);
    const { data, error } = await supabase.functions.invoke(
      "rentauto-admin-settlements",
      {
        body: {
          action: "reverse",
          settlementId: settlement.id,
          amountCents: amount,
          reason: draft.reason.trim(),
        },
      },
    );
    setBusyId(null);

    const response = (data ?? {}) as {
      ok?: boolean;
      error?: string;
      reversalId?: string;
    };

    if (error || !response.ok) {
      toast({
        title: "Reversal failed",
        description: response.error ?? error?.message ?? "Try again.",
        variant: "destructive",
      });
      await load();
      return;
    }

    toast({
      title: "Transfer reversed",
      description: response.reversalId
        ? "Stripe reversal " + response.reversalId + " was recorded."
        : "The reversal was recorded.",
    });
    setReversals((current) => {
      const next = { ...current };
      delete next[settlement.id];
      return next;
    });
    await load();
  };

  const currency = settlements.find((row) => row.currency)?.currency ?? "CAD";

  return (
    <div className="container max-w-7xl space-y-6 py-8 pb-24">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            to="/admin"
            className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Admin control center
          </Link>
          <h1 className="text-3xl font-bold">Payouts & settlements</h1>
          <p className="mt-1 text-muted-foreground">
            Stripe Connect release authority, dispute holds and transfer reversals.
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          Refresh
        </Button>
      </div>

      <Card className={!policy?.payouts_enabled ? "border-amber-300" : undefined}>
        <CardHeader>
          <CardTitle>Settlement policy</CardTitle>
          <CardDescription>
            No payout can be released until this policy is explicitly configured
            and enabled by an administrator.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
          <div className="space-y-1">
            <Label htmlFor="fee">Platform fee (%)</Label>
            <Input
              id="fee"
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={feePercent}
              onChange={(event) => setFeePercent(event.target.value)}
              placeholder="Not configured"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="window">Dispute window (hours)</Label>
            <Input
              id="window"
              type="number"
              min={0}
              max={720}
              step={1}
              value={windowHours}
              onChange={(event) => setWindowHours(event.target.value)}
              placeholder="Not configured"
            />
          </div>
          <div className="flex items-end gap-3">
            <label className="flex h-10 items-center gap-2 rounded-md border px-3 text-sm">
              <Checkbox
                checked={payoutsEnabled}
                onCheckedChange={(value) => setPayoutsEnabled(Boolean(value))}
              />
              Enable payouts
            </label>
            <Button onClick={() => void savePolicy()} disabled={savingPolicy}>
              <Save className="h-4 w-4" />
              {savingPolicy ? "Saving…" : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={Banknote}
          label="Eligible"
          value={money(summary.eligible, currency)}
        />
        <MetricCard
          icon={Clock3}
          label="Held / blocked"
          value={money(summary.held, currency)}
        />
        <MetricCard
          icon={WalletCards}
          label="Net transferred"
          value={money(summary.transferred, currency)}
        />
        <MetricCard
          icon={ShieldAlert}
          label="Reversals required"
          value={String(summary.reversalRequired)}
        />
      </div>

      <div className="flex items-center gap-2">
        <Label htmlFor="status-filter" className="text-sm">Queue</Label>
        <select
          id="status-filter"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="all">All</option>
          <option value="eligible">Eligible</option>
          <option value="hold">Dispute window</option>
          <option value="blocked">Blocked</option>
          <option value="transferred">Transferred</option>
          <option value="reversal_required">Reversal required</option>
          <option value="failed">Failed</option>
          <option value="reversed">Reversed</option>
        </select>
      </div>

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      ) : settlements.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No settlements match this queue.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {settlements.map((settlement) => {
            const remaining = Math.max(
              0,
              (settlement.host_amount_cents ?? 0) -
                (settlement.reversed_amount_cents ?? 0),
            );
            const draft = reversals[settlement.id] ?? {
              amount: "",
              reason: "",
            };

            return (
              <Card key={settlement.id}>
                <CardContent className="space-y-4 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">
                        {settlement.bookingReference ??
                          "Trip " + settlement.trip_id.slice(0, 8)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {settlement.vehicle} · {settlement.hostName}
                      </p>
                    </div>
                    <Badge
                      variant={statusVariant(settlement.status)}
                      className="capitalize"
                    >
                      {settlement.status.replace(/_/g, " ")}
                    </Badge>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <Value
                      label="Rental revenue"
                      value={money(
                        settlement.rental_revenue_cents,
                        settlement.currency,
                      )}
                    />
                    <Value
                      label="Platform fee"
                      value={money(
                        settlement.platform_fee_cents,
                        settlement.currency,
                      )}
                    />
                    <Value
                      label="Host amount"
                      value={money(
                        settlement.host_amount_cents,
                        settlement.currency,
                      )}
                    />
                    <Value
                      label="Refunded"
                      value={money(
                        settlement.refunded_cents,
                        settlement.currency,
                      )}
                    />
                    <Value
                      label="Net remaining"
                      value={money(remaining, settlement.currency)}
                    />
                  </div>

                  <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
                    {settlement.hold_reason
                      ? "Reason: " + settlement.hold_reason.replace(/_/g, " ")
                      : settlement.eligible_at
                        ? "Eligible at " +
                          new Date(settlement.eligible_at).toLocaleString()
                        : "No hold reason."}
                    {settlement.last_error
                      ? " · Last error: " + settlement.last_error
                      : ""}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() => void refresh(settlement)}
                      disabled={busyId === settlement.id}
                    >
                      <RefreshCw className="h-4 w-4" /> Re-evaluate
                    </Button>
                    {settlement.status === "eligible" ? (
                      <Button
                        onClick={() => void release(settlement)}
                        disabled={
                          busyId === settlement.id || !policy?.payouts_enabled
                        }
                      >
                        <WalletCards className="h-4 w-4" />
                        Release {money(settlement.host_amount_cents, settlement.currency)}
                      </Button>
                    ) : null}
                  </div>

                  {settlement.stripe_transfer_id &&
                  ["transferred", "reversal_required", "partially_reversed"].includes(
                    settlement.status,
                  ) &&
                  remaining > 0 ? (
                    <div className="grid gap-3 border-t pt-4 md:grid-cols-[180px_1fr_auto]">
                      <div className="space-y-1">
                        <Label>Reverse amount (CAD)</Label>
                        <Input
                          type="number"
                          min={0.01}
                          step="0.01"
                          value={draft.amount}
                          onChange={(event) =>
                            setReversals((current) => ({
                              ...current,
                              [settlement.id]: {
                                ...draft,
                                amount: event.target.value,
                              },
                            }))
                          }
                          placeholder="0.00"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Reason</Label>
                        <Textarea
                          rows={1}
                          value={draft.reason}
                          onChange={(event) =>
                            setReversals((current) => ({
                              ...current,
                              [settlement.id]: {
                                ...draft,
                                reason: event.target.value,
                              },
                            }))
                          }
                          placeholder="Refund, dispute, correction…"
                        />
                      </div>
                      <div className="flex items-end">
                        <Button
                          variant="destructive"
                          onClick={() => void reverse(settlement)}
                          disabled={busyId === settlement.id}
                        >
                          <RotateCcw className="h-4 w-4" /> Reverse transfer
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Banknote;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <p className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 text-xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function Value({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
