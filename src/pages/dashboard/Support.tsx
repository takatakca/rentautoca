import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { LifeBuoy, Send } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { DashboardSkeleton } from "@/components/ui/skeletons";
import { DashboardPageHeader, StatusBadge } from "@/components/dashboard/DashboardPageHeader";
import { useToast } from "@/hooks/use-toast";
import { bookingRef, type Tone } from "@/lib/dashboard-utils";

const schema = z.object({
  subject: z.string().trim().min(4, "Subject must be at least 4 characters").max(150),
  category: z.string().min(1, "Choose a category"),
  message: z.string().trim().min(20, "Please describe the issue in at least 20 characters").max(2000),
});

const CATEGORIES = [
  { value: "booking", label: "Booking issue" },
  { value: "payment", label: "Payment or refund" },
  { value: "vehicle", label: "Vehicle problem" },
  { value: "accident", label: "Accident or damage" },
  { value: "account", label: "Account & verification" },
  { value: "other", label: "Something else" },
];

const TICKET_TONE: Record<string, Tone> = {
  open: "info",
  in_progress: "warning",
  waiting_on_user: "warning",
  resolved: "success",
  closed: "neutral",
};

export default function DashboardSupport() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ subject: "", category: "", message: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [searchParams] = useSearchParams();
  const tripId = searchParams.get("trip");
  const [tripContext, setTripContext] = useState<{
    reference: string;
    vehicle: string;
    dates: string;
  } | null>(null);

  useEffect(() => {
    if (!tripId || !user) return;
    let cancelled = false;
    (async () => {
      const { data: t } = await supabase
        .from("trips")
        .select("id, car_id, start_at, end_at, created_at, booking_reference")
        .eq("id", tripId)
        .maybeSingle();
      if (cancelled || !t) return;
      const { data: c } = await supabase
        .from("cars")
        .select("make, model, year")
        .eq("id", t.car_id)
        .maybeSingle();
      if (cancelled) return;
      setTripContext({
        reference: bookingRef(t.id, t.created_at, t.booking_reference),
        vehicle: c ? `${c.year} ${c.make} ${c.model}` : "Your rental",
        dates: `${format(new Date(t.start_at), "MMM d, yyyy")} → ${format(new Date(t.end_at), "MMM d, yyyy")}`,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [tripId, user]);

  const load = async () => {
    const { data } = await supabase
      .from("support_tickets")
      .select("*")
      .order("created_at", { ascending: false });
    setTickets(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (user) load();
  }, [user]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const f = parsed.error.flatten().fieldErrors;
      setErrors({
        subject: f.subject?.[0] ?? "",
        category: f.category?.[0] ?? "",
        message: f.message?.[0] ?? "",
      });
      return;
    }
    setErrors({});
    setSaving(true);
    const { error } = await supabase.from("support_tickets").insert({
      user_id: user!.id,
      subject: parsed.data.subject,
      category: parsed.data.category,
      body: parsed.data.message,
      trip_id: tripId,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Could not send", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Request sent", description: "Our team replies within 24 hours." });
    setForm({ subject: "", category: "", message: "" });
    load();
  };

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Support"
        description="Open a request and track its status. Urgent roadside issues should be reported from the trip page."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <LifeBuoy className="h-4 w-4 text-primary" aria-hidden="true" /> New request
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tripContext && (
              <div className="mb-4 rounded-lg border border-border bg-muted/40 p-3 text-sm">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">About this trip</p>
                <p className="mt-1 font-medium">{tripContext.vehicle}</p>
                <p className="text-xs text-muted-foreground">{tripContext.dates}</p>
                <p className="font-mono text-xs text-muted-foreground">Booking {tripContext.reference}</p>
              </div>
            )}
            <form onSubmit={submit} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  value={form.subject}
                  maxLength={150}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  aria-invalid={Boolean(errors.subject)}
                />
                {errors.subject && <p className="text-xs text-destructive">{errors.subject}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="category">Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger id="category" aria-invalid={Boolean(errors.category)}>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.category && <p className="text-xs text-destructive">{errors.category}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="message">How can we help?</Label>
                <Textarea
                  id="message"
                  rows={6}
                  maxLength={2000}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  aria-invalid={Boolean(errors.message)}
                />
                {errors.message && <p className="text-xs text-destructive">{errors.message}</p>}
              </div>
              <Button type="submit" disabled={saving} className="w-full sm:w-auto">
                <Send className="mr-2 h-4 w-4" /> {saving ? "Sending…" : "Send request"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Your requests</CardTitle>
          </CardHeader>
          <CardContent>
            {tickets.length === 0 ? (
              <EmptyState
                icon={LifeBuoy}
                title="No requests yet"
                description="When you contact support, your conversation history shows up here."
              />
            ) : (
              <ul className="divide-y divide-border">
                {tickets.map((t) => (
                  <li key={t.id} className="space-y-1 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="min-w-0 truncate font-medium">{t.subject}</p>
                      <StatusBadge tone={TICKET_TONE[t.status] ?? "neutral"}>
                        {String(t.status).replace(/_/g, " ")}
                      </StatusBadge>
                    </div>
                    <p className="line-clamp-2 text-sm text-muted-foreground">{t.body}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(t.created_at), "MMM d, yyyy • HH:mm")}
                      {t.last_response_at
                        ? ` · answered ${format(new Date(t.last_response_at), "MMM d")}`
                        : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
