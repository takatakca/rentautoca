import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { CreditCard, Receipt, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { DashboardSkeleton } from "@/components/ui/skeletons";
import { DashboardPageHeader, StatusBadge } from "@/components/dashboard/DashboardPageHeader";
import { PAYMENT_STATUS, money, bookingRef } from "@/lib/dashboard-utils";

interface Row {
  id: string;
  car_id: string;
  start_at: string;
  end_at: string;
  status: string;
  payment_status: string | null;
  total_cents: number | null;
  currency: string;
  pricing_breakdown: any;
  created_at: string;
}

export default function DashboardPayments() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [cars, setCars] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("trips")
        .select("id, car_id, start_at, end_at, status, payment_status, total_cents, currency, pricing_breakdown, created_at")
        .eq("guest_id", user.id)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      const list = (data ?? []) as Row[];
      setRows(list);
      const ids = [...new Set(list.map((t) => t.car_id))];
      if (ids.length) {
        const { data: c } = await supabase.from("cars").select("id, make, model, year").in("id", ids);
        if (cancelled) return;
        const cm: Record<string, any> = {};
        (c ?? []).forEach((x: any) => (cm[x.id] = x));
        setCars(cm);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const paid = useMemo(() => rows.filter((r) => r.payment_status === "paid"), [rows]);
  const totalSpent = useMemo(() => paid.reduce((s, r) => s + (r.total_cents ?? 0), 0), [paid]);

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Payments & receipts"
        description="Every charge, refund and price breakdown for your bookings."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Total paid</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{money(totalSpent)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Paid bookings</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{paid.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Awaiting payment</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {rows.filter((r) => r.status === "pending_payment").length}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-4 w-4 text-primary" aria-hidden="true" /> Transaction history
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <EmptyState
              icon={CreditCard}
              title="No payments yet"
              description="Your receipts and refunds appear here after your first booking."
              action={{ label: "Browse vehicles", href: "/explore" }}
            />
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((r) => {
                const c = cars[r.car_id];
                const pm = PAYMENT_STATUS[r.payment_status ?? "unpaid"] ?? PAYMENT_STATUS.unpaid;
                const b = r.pricing_breakdown ?? {};
                return (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {c ? `${c.year} ${c.make} ${c.model}` : "Booking"}{" "}
                        <span className="text-xs font-normal text-muted-foreground">
                          {bookingRef(r.id, r.created_at)}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(r.created_at), "MMM d, yyyy")} ·{" "}
                        {format(new Date(r.start_at), "MMM d")} → {format(new Date(r.end_at), "MMM d")}
                      </p>
                      {(b.subtotal_cents != null || b.tax_cents != null) && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Subtotal {money(b.subtotal_cents)} · Fees {money(b.fees_cents ?? 0)} · Taxes{" "}
                          {money(b.tax_cents ?? 0)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge tone={pm.tone}>{pm.label}</StatusBadge>
                      <span className="font-semibold tabular-nums">{money(r.total_cents, r.currency)}</span>
                      <Button asChild variant="ghost" size="sm">
                        <Link to={`/trips/${r.id}`}>
                          <Download className="mr-1 h-3.5 w-3.5" /> Receipt
                        </Link>
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Card details are handled entirely by our payment processor — Rentauto never stores your card number.
      </p>
    </div>
  );
}
