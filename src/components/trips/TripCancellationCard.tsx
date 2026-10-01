import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, RotateCcw, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type CancellationRow = Tables<"trip_cancellations">;

type Preview = {
  tripId: string;
  bookingReference?: string | null;
  actorRole: "guest" | "host" | "admin";
  existing: boolean;
  automatic?: boolean;
  manualReview?: boolean;
  requiresRefund?: boolean;
  refundAmountCents?: number | null;
  refundPercentage?: number | null;
  currency: string;
  ruleSource?: string;
  manualReason?: string | null;
  policySnapshot?: {
    name?: string;
    summary?: string;
    rules?: Record<string, unknown>;
  } | null;
  cancellationId?: string;
  status?: string;
  stripeRefundId?: string | null;
};

function money(cents: number | null | undefined, currency = "CAD") {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}

export function TripCancellationCard({
  tripId,
  tripStatus,
  currentUserId,
  guestId,
  hostId,
}: {
  tripId: string;
  tripStatus: string;
  currentUserId: string | null | undefined;
  guestId: string;
  hostId: string | null | undefined;
}) {
  const { toast } = useToast();
  const [existing, setExisting] = useState<CancellationRow | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [reason, setReason] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const participant =
    Boolean(currentUserId) &&
    (currentUserId === guestId || currentUserId === hostId);

  const cancellableStatus = [
    "requested",
    "approved",
    "draft",
    "confirmed",
    "check_in_pending",
  ].includes(tripStatus);

  useEffect(() => {
    if (!participant) return;
    let active = true;

    void supabase
      .from("trip_cancellations")
      .select("*")
      .eq("trip_id", tripId)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setExisting(data);
      });

    return () => {
      active = false;
    };
  }, [participant, tripId]);

  const terminalCancellation = useMemo(
    () =>
      existing &&
      [
        "refunded",
        "cancelled_unpaid",
        "cancelled_no_refund",
        "denied",
      ].includes(existing.status),
    [existing],
  );

  if (!participant) return null;
  if (!cancellableStatus && !existing && tripStatus !== "cancelled") return null;

  const loadPreview = async () => {
    setLoadingPreview(true);
    const { data, error } = await supabase.functions.invoke("rentauto-cancel-trip", {
      body: { action: "preview", tripId },
    });
    setLoadingPreview(false);

    const response = (data ?? {}) as { preview?: Preview; error?: string };
    if (error || !response.preview) {
      toast({
        title: "Cancellation preview unavailable",
        description: response.error ?? error?.message ?? "Try again.",
        variant: "destructive",
      });
      return;
    }

    setPreview(response.preview);
  };

  const cancel = async () => {
    if (reason.trim().length < 5) {
      toast({
        title: "Add a cancellation reason",
        description: "Use at least 5 characters.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("rentauto-cancel-trip", {
      body: {
        action: "cancel",
        tripId,
        reason: reason.trim(),
      },
    });
    setSubmitting(false);

    const response = (data ?? {}) as {
      ok?: boolean;
      manualReview?: boolean;
      error?: string;
      refundStatus?: string;
      cancellation?: {
        cancellationId?: string;
        status?: string;
      };
    };

    if (error || !response.ok) {
      toast({
        title: "Cancellation not completed",
        description:
          response.error ??
          error?.message ??
          "No booking or refund state was changed. Try again.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: response.manualReview
        ? "Cancellation review requested"
        : response.refundStatus === "pending" ||
            response.refundStatus === "requires_action"
          ? "Refund is processing"
          : "Cancellation processed",
      description: response.manualReview
        ? "Rentauto operations will review the refund amount before changing the booking."
        : "The booking record and financial state are being synchronized.",
    });

    window.location.reload();
  };

  if (existing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <RotateCcw className="h-4 w-4" /> Cancellation
          </CardTitle>
          <CardDescription>
            This booking has a recorded cancellation workflow.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-muted-foreground">Status</span>
            <Badge
              variant={
                existing.status === "failed"
                  ? "destructive"
                  : existing.status === "manual_review" ||
                      existing.status === "refund_pending" ||
                      existing.status === "processing"
                    ? "secondary"
                    : "outline"
              }
              className="capitalize"
            >
              {statusLabel(existing.status)}
            </Badge>
          </div>
          {existing.refund_amount_cents != null ? (
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Refund amount</span>
              <span className="font-semibold">
                {money(existing.refund_amount_cents, existing.currency)}
              </span>
            </div>
          ) : null}
          {existing.status === "manual_review" ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
              The booking remains reserved while Rentauto reviews the refund terms.
            </p>
          ) : null}
          {existing.status === "refund_pending" ||
          existing.status === "processing" ? (
            <p className="rounded-lg border p-3 text-muted-foreground">
              The booking remains reserved until Stripe confirms the refund.
            </p>
          ) : null}
          {existing.status === "failed" ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-destructive">
              The refund needs operations review. The booking has not been released automatically.
            </p>
          ) : null}
          {terminalCancellation ? (
            <p className="text-xs text-muted-foreground">
              Recorded {new Date(existing.updated_at).toLocaleString()}.
            </p>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <XCircle className="h-4 w-4" /> Cancel booking
        </CardTitle>
        <CardDescription>
          Rentauto calculates cancellation outcomes from the policy snapshot saved with this booking.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!preview ? (
          <Button
            variant="outline"
            onClick={() => void loadPreview()}
            disabled={loadingPreview}
          >
            {loadingPreview ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            Review cancellation
          </Button>
        ) : (
          <>
            <div className="rounded-xl border p-4 text-sm">
              <p className="font-semibold">
                {preview.policySnapshot?.name || "Booking cancellation policy"}
              </p>
              {preview.policySnapshot?.summary ? (
                <p className="mt-1 text-muted-foreground">
                  {preview.policySnapshot.summary}
                </p>
              ) : null}

              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="text-muted-foreground">
                  {preview.manualReview ? "Automatic refund" : "Refund"}
                </span>
                <span className="font-semibold">
                  {preview.manualReview
                    ? "Manual review required"
                    : money(preview.refundAmountCents, preview.currency)}
                </span>
              </div>

              {preview.refundPercentage != null ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {preview.refundPercentage}% of the charged booking total.
                </p>
              ) : null}

              {preview.manualReview ? (
                <div className="mt-3 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>
                    Your saved policy does not define an automatic refund for this timing.
                    Rentauto will not guess a charge or refund amount; operations must review it.
                  </p>
                </div>
              ) : null}
            </div>

            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={1000}
              rows={3}
              placeholder="Why are you cancelling this booking?"
            />

            <div className="flex flex-wrap gap-2">
              <Button
                variant="destructive"
                onClick={() => void cancel()}
                disabled={submitting || reason.trim().length < 5}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                {preview.manualReview
                  ? "Request cancellation review"
                  : preview.requiresRefund
                    ? "Cancel & process refund"
                    : "Cancel booking"}
              </Button>
              <Button variant="ghost" onClick={() => setPreview(null)} disabled={submitting}>
                Keep booking
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
