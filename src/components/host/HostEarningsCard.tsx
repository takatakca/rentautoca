import { useEffect, useMemo, useState } from "react";
import { Banknote, Clock3, Loader2, ShieldAlert, WalletCards } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Settlement = Pick<
  Tables<"trip_settlements">,
  | "id"
  | "trip_id"
  | "currency"
  | "host_amount_cents"
  | "reversed_amount_cents"
  | "refunded_cents"
  | "status"
  | "hold_reason"
  | "eligible_at"
  | "transferred_at"
  | "stripe_transfer_id"
  | "updated_at"
>;

function money(cents: number, currency = "CAD") {
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
  if (status === "hold" || status === "pending_trip") return "secondary";
  return "outline";
}

export function HostEarningsCard() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Settlement[]>([]);
  const [bookingRefs, setBookingRefs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    let active = true;
    void (async () => {
      setLoading(true);

      const { data } = await supabase
        .from("trip_settlements")
        .select(
          "id,trip_id,currency,host_amount_cents,reversed_amount_cents,refunded_cents,status,hold_reason,eligible_at,transferred_at,stripe_transfer_id,updated_at",
        )
        .eq("host_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(50);

      const settlements = data ?? [];
      const tripIds = [...new Set(settlements.map((row) => row.trip_id))];
      const refs: Record<string, string> = {};

      if (tripIds.length > 0) {
        const { data: trips } = await supabase
          .from("trips")
          .select("id,booking_reference")
          .in("id", tripIds);

        for (const trip of trips ?? []) {
          refs[trip.id] = trip.booking_reference;
        }
      }

      if (!active) return;
      setRows(settlements);
      setBookingRefs(refs);
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [user]);

  const summary = useMemo(() => {
    let transferred = 0;
    let available = 0;
    let pending = 0;

    for (const row of rows) {
      const hostAmount = row.host_amount_cents ?? 0;
      const netTransferred = Math.max(
        0,
        hostAmount - (row.reversed_amount_cents ?? 0),
      );

      if (row.stripe_transfer_id) {
        transferred += netTransferred;
      } else if (row.status === "eligible") {
        available += hostAmount;
      } else {
        pending += hostAmount;
      }
    }

    return { transferred, available, pending };
  }, [rows]);

  const currency = rows.find((row) => row.currency)?.currency ?? "CAD";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <WalletCards className="h-5 w-5" /> Host earnings
        </CardTitle>
        <CardDescription>
          Ledger-backed earnings after the Rentauto platform fee. Transfers are
          released only after the trip and dispute window requirements are met.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading settlement ledger…
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Net transferred
                </p>
                <p className="mt-2 flex items-center gap-2 text-xl font-bold">
                  <Banknote className="h-4 w-4" />
                  {money(summary.transferred, currency)}
                </p>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Eligible
                </p>
                <p className="mt-2 text-xl font-bold">
                  {money(summary.available, currency)}
                </p>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Pending / held
                </p>
                <p className="mt-2 flex items-center gap-2 text-xl font-bold">
                  <Clock3 className="h-4 w-4" />
                  {money(summary.pending, currency)}
                </p>
              </div>
            </div>

            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No host settlements yet. Paid bookings will appear here once a
                settlement policy is configured.
              </p>
            ) : (
              <div className="divide-y rounded-xl border">
                {rows.slice(0, 8).map((row) => (
                  <div
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">
                        {bookingRefs[row.trip_id] ?? ("Trip " + row.trip_id.slice(0, 8))}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {row.hold_reason
                          ? row.hold_reason.replace(/_/g, " ")
                          : row.eligible_at
                            ? "Eligible " + new Date(row.eligible_at).toLocaleString()
                            : "Settlement pending"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {(row.refunded_cents ?? 0) > 0 ||
                      row.status === "reversal_required" ? (
                        <ShieldAlert className="h-4 w-4 text-destructive" />
                      ) : null}
                      <span className="font-semibold">
                        {row.host_amount_cents == null
                          ? "—"
                          : money(
                              Math.max(
                                0,
                                row.host_amount_cents -
                                  (row.reversed_amount_cents ?? 0),
                              ),
                              row.currency,
                            )}
                      </span>
                      <Badge
                        variant={statusVariant(row.status)}
                        className="capitalize"
                      >
                        {row.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
