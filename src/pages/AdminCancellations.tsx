import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type Cancellation = {
  id: string;
  trip_id: string;
  actor_user_id: string;
  actor_role: string;
  reason: string;
  policy_snapshot: {
    name?: string;
    summary?: string;
    rules?: Record<string, unknown>;
  } | null;
  rule_source: string;
  refund_percentage: number | null;
  refund_amount_cents: number | null;
  original_total_cents: number;
  currency: string;
  status: string;
  stripe_refund_id: string | null;
  attempt_count: number;
  resolution_notes: string | null;
  requested_at: string;
  updated_at: string;
  resolved_at: string | null;
  bookingReference: string | null;
  tripStatus: string | null;
  paymentStatus: string | null;
  vehicle: string;
};

type Draft = {
  amount: string;
  notes: string;
};

function money(cents: number | null | undefined, currency = "CAD") {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

function statusVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "failed") return "destructive";
  if (
    status === "manual_review" ||
    status === "processing" ||
    status === "refund_pending"
  ) {
    return "secondary";
  }
  if (status === "refunded") return "default";
  return "outline";
}

export default function AdminCancellations() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Cancellation[]>([]);
  const [filter, setFilter] = useState("manual_review");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("rentauto-cancel-trip", {
      body: { action: "list", status: filter },
    });
    setLoading(false);

    const response = (data ?? {}) as {
      cancellations?: Cancellation[];
      error?: string;
    };

    if (error || response.error) {
      toast({
        title: "Cancellation queue unavailable",
        description: response.error ?? error?.message ?? "Try again.",
        variant: "destructive",
      });
      setRows([]);
      return;
    }

    setRows(response.cancellations ?? []);
  }, [filter, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(
    () => ({
      manual: rows.filter((row) => row.status === "manual_review").length,
      pending: rows.filter((row) =>
        ["processing", "refund_pending"].includes(row.status),
      ).length,
      failed: rows.filter((row) => row.status === "failed").length,
    }),
    [rows],
  );

  const draftFor = (row: Cancellation): Draft =>
    drafts[row.id] ?? {
      amount:
        row.refund_amount_cents == null
          ? ""
          : (row.refund_amount_cents / 100).toFixed(2),
      notes: row.resolution_notes ?? "",
    };

  const updateDraft = (row: Cancellation, patch: Partial<Draft>) => {
    setDrafts((current) => ({
      ...current,
      [row.id]: {
        ...draftFor(row),
        ...patch,
      },
    }));
  };

  const resolve = async (
    row: Cancellation,
    decision: "approve" | "deny",
  ) => {
    const draft = draftFor(row);
    const amount =
      decision === "approve"
        ? Math.round(Number(draft.amount) * 100)
        : null;

    if (
      draft.notes.trim().length < 10 ||
      (decision === "approve" &&
        (!Number.isSafeInteger(amount) ||
          amount == null ||
          amount < 0 ||
          amount > row.original_total_cents))
    ) {
      toast({
        title: "Resolution incomplete",
        description:
          "Add at least 10 characters of review notes and a valid refund amount.",
        variant: "destructive",
      });
      return;
    }

    setBusyId(row.id);
    const { data, error } = await supabase.functions.invoke("rentauto-cancel-trip", {
      body: {
        action: "resolve",
        cancellationId: row.id,
        decision,
        refundAmountCents: amount,
        notes: draft.notes.trim(),
      },
    });
    setBusyId(null);

    const response = (data ?? {}) as {
      ok?: boolean;
      error?: string;
      refundStatus?: string;
    };

    if (error || !response.ok) {
      toast({
        title: "Resolution not completed",
        description: response.error ?? error?.message ?? "Try again.",
        variant: "destructive",
      });
      await load();
      return;
    }

    toast({
      title:
        decision === "deny"
          ? "Cancellation request denied"
          : response.refundStatus === "pending" ||
              response.refundStatus === "requires_action"
            ? "Refund is processing"
            : "Cancellation resolved",
      description:
        decision === "deny"
          ? "The booking remains active."
          : "The decision and financial operation were recorded.",
    });
    await load();
  };

  const retry = async (row: Cancellation) => {
    setBusyId(row.id);
    const { data, error } = await supabase.functions.invoke("rentauto-cancel-trip", {
      body: {
        action: "retry",
        cancellationId: row.id,
      },
    });
    setBusyId(null);

    const response = (data ?? {}) as {
      ok?: boolean;
      error?: string;
      refundStatus?: string;
    };

    if (error || !response.ok) {
      toast({
        title: "Refund retry not completed",
        description: response.error ?? error?.message ?? "Try again.",
        variant: "destructive",
      });
      await load();
      return;
    }

    toast({
      title: "Refund retry submitted",
      description:
        response.refundStatus === "succeeded"
          ? "Stripe confirmed the refund."
          : "The refund remains under Stripe processing.",
    });
    await load();
  };

  return (
    <div className="container max-w-6xl space-y-6 py-8 pb-24">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            to="/admin"
            className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Admin control center
          </Link>
          <h1 className="text-3xl font-bold">Cancellations & refunds</h1>
          <p className="mt-1 text-muted-foreground">
            Review cases not explicitly covered by the booking policy snapshot and monitor Stripe refunds.
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Manual review" value={summary.manual} />
        <SummaryCard label="Refund processing" value={summary.pending} />
        <SummaryCard label="Refund failed" value={summary.failed} danger />
      </div>

      <div className="flex items-center gap-2">
        <Label htmlFor="cancellation-filter">Queue</Label>
        <select
          id="cancellation-filter"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="manual_review">Manual review</option>
          <option value="processing">Processing</option>
          <option value="refund_pending">Refund pending</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
          <option value="cancelled_unpaid">Cancelled unpaid</option>
          <option value="cancelled_no_refund">Cancelled no refund</option>
          <option value="denied">Denied</option>
          <option value="all">All</option>
        </select>
      </div>

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No cancellation cases match this queue.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {rows.map((row) => {
            const draft = draftFor(row);

            return (
              <Card key={row.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">
                        {row.bookingReference ?? "Trip " + row.trip_id.slice(0, 8)}
                      </CardTitle>
                      <CardDescription>
                        {row.vehicle} · requested by {row.actor_role}
                      </CardDescription>
                    </div>
                    <Badge
                      variant={statusVariant(row.status)}
                      className="capitalize"
                    >
                      {row.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Value
                      label="Booking total"
                      value={money(row.original_total_cents, row.currency)}
                    />
                    <Value
                      label="Refund"
                      value={money(row.refund_amount_cents, row.currency)}
                    />
                    <Value
                      label="Trip"
                      value={(row.tripStatus ?? "unknown").replace(/_/g, " ")}
                    />
                    <Value
                      label="Payment"
                      value={(row.paymentStatus ?? "unknown").replace(/_/g, " ")}
                    />
                  </div>

                  <div className="rounded-lg border bg-muted/20 p-4 text-sm">
                    <p className="font-medium">Reason</p>
                    <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                      {row.reason}
                    </p>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Rule: {row.rule_source.replace(/_/g, " ")} · Requested{" "}
                      {new Date(row.requested_at).toLocaleString()}
                    </p>
                    {row.policy_snapshot?.summary ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Saved policy: {row.policy_snapshot.summary}
                      </p>
                    ) : null}
                  </div>

                  {row.status === "manual_review" ? (
                    <div className="grid gap-3 md:grid-cols-[180px_1fr]">
                      <div className="space-y-1">
                        <Label>Refund amount (CAD)</Label>
                        <Input
                          type="number"
                          min={0}
                          max={row.original_total_cents / 100}
                          step="0.01"
                          value={draft.amount}
                          onChange={(event) =>
                            updateDraft(row, { amount: event.target.value })
                          }
                          placeholder="Enter explicit amount"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Review notes</Label>
                        <Textarea
                          rows={2}
                          maxLength={4000}
                          value={draft.notes}
                          onChange={(event) =>
                            updateDraft(row, { notes: event.target.value })
                          }
                          placeholder="Document the policy interpretation and decision."
                        />
                      </div>

                      <div className="flex flex-wrap gap-2 md:col-span-2">
                        <Button
                          onClick={() => void resolve(row, "approve")}
                          disabled={busyId === row.id}
                        >
                          <RotateCcw className="h-4 w-4" />
                          Approve cancellation
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => void resolve(row, "deny")}
                          disabled={busyId === row.id}
                        >
                          <XCircle className="h-4 w-4" />
                          Deny request
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  {row.status === "failed" ? (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                      <div className="flex gap-2 text-sm text-destructive">
                        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                        <div>
                          <p className="font-medium">Stripe refund needs retry</p>
                          <p className="text-xs">
                            Attempt {row.attempt_count}. The booking remains reserved until a refund succeeds.
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="destructive"
                        onClick={() => void retry(row)}
                        disabled={busyId === row.id}
                      >
                        <RotateCcw className="h-4 w-4" /> Retry safely
                      </Button>
                    </div>
                  ) : null}

                  <Button asChild size="sm" variant="ghost">
                    <Link to={"/trips/" + row.trip_id}>Open trip</Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p
          className={
            danger && value > 0
              ? "mt-1 text-2xl font-bold text-destructive"
              : "mt-1 text-2xl font-bold"
          }
        >
          {value}
        </p>
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
      <p className="mt-1 font-semibold capitalize">{value}</p>
    </div>
  );
}
