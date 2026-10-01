import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import {
  AlertTriangle,
  LifeBuoy,
  Loader2,
  MessageSquare,
  Plus,
  Send,
} from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardPageHeader, StatusBadge } from "@/components/dashboard/DashboardPageHeader";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DashboardSkeleton } from "@/components/ui/skeletons";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { bookingRef, type Tone } from "@/lib/dashboard-utils";
import { cn } from "@/lib/utils";

const newTicketSchema = z.object({
  subject: z.string().trim().min(4, "Subject must be at least 4 characters").max(150),
  category: z.string().min(1, "Choose a category"),
  message: z.string().trim().min(20, "Please describe the issue in at least 20 characters").max(4000),
});

const CATEGORIES = [
  { value: "booking", label: "Booking issue" },
  { value: "payment", label: "Payment or refund" },
  { value: "vehicle", label: "Vehicle problem" },
  { value: "roadside", label: "Roadside / vehicle disabled" },
  { value: "accident", label: "Accident or damage" },
  { value: "account", label: "Account & verification" },
  { value: "other", label: "Something else" },
] as const;

const TICKET_TONE: Record<string, Tone> = {
  open: "info",
  in_progress: "warning",
  waiting_customer: "warning",
  resolved: "success",
  closed: "neutral",
};

function statusLabel(status: string) {
  if (status === "waiting_customer") return "waiting on you";
  return status.replace(/_/g, " ");
}

type SupportMessage = Tables<"support_ticket_messages">;

export default function DashboardSupport() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [tickets, setTickets] = useState<Tables<"support_tickets">[]>([]);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [replying, setReplying] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [reply, setReply] = useState("");
  const [form, setForm] = useState({ subject: "", category: "", message: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const tripId = searchParams.get("trip");
  const selectedTicketId = searchParams.get("ticket");

  const [tripContext, setTripContext] = useState<{
    reference: string;
    vehicle: string;
    dates: string;
  } | null>(null);

  useEffect(() => {
    if (!tripId || !user) return;
    let cancelled = false;
    void (async () => {
      const { data: trip } = await supabase
        .from("trips")
        .select("id,car_id,start_at,end_at,created_at,booking_reference")
        .eq("id", tripId)
        .maybeSingle();

      if (cancelled || !trip) return;

      const { data: car } = await supabase
        .from("cars_accessible")
        .select("make,model,year")
        .eq("id", trip.car_id)
        .maybeSingle();

      if (cancelled) return;

      setTripContext({
        reference: bookingRef(trip.id, trip.created_at, trip.booking_reference),
        vehicle: car ? `${car.year} ${car.make} ${car.model}` : "Your rental",
        dates: `${format(new Date(trip.start_at), "MMM d, yyyy")} → ${format(new Date(trip.end_at), "MMM d, yyyy")}`,
      });
      setShowNew(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [tripId, user]);

  const loadTickets = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("support_tickets")
      .select("*")
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Support unavailable",
        description: error.message,
        variant: "destructive",
      });
      setTickets([]);
    } else {
      setTickets(data ?? []);
    }
    setLoading(false);
  }, [toast, user]);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedTicketId) ?? null,
    [selectedTicketId, tickets],
  );

  const loadMessages = useCallback(async () => {
    if (!selectedTicketId || !user) {
      setMessages([]);
      return;
    }

    setThreadLoading(true);
    const { data, error } = await supabase
      .from("support_ticket_messages")
      .select("*")
      .eq("ticket_id", selectedTicketId)
      .order("created_at", { ascending: true });

    if (error) {
      toast({
        title: "Conversation unavailable",
        description: error.message,
        variant: "destructive",
      });
      setMessages([]);
      setThreadLoading(false);
      return;
    }

    const rows = data ?? [];
    setMessages(rows);
    setThreadLoading(false);

    const unreadAdminIds = rows
      .filter((message) => message.sender_is_admin && message.read_at === null)
      .map((message) => message.id);

    if (unreadAdminIds.length > 0) {
      const readAt = new Date().toISOString();
      setMessages((current) =>
        current.map((message) =>
          unreadAdminIds.includes(message.id)
            ? { ...message, read_at: readAt }
            : message,
        ),
      );
      await supabase
        .from("support_ticket_messages")
        .update({ read_at: readAt })
        .in("id", unreadAdminIds);
    }
  }, [selectedTicketId, toast, user]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`support-messages-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "rentauto", table: "support_ticket_messages" },
        (payload) => {
          const incoming = payload.new as SupportMessage;
          if (incoming.ticket_id === selectedTicketId) {
            setMessages((current) =>
              current.some((message) => message.id === incoming.id)
                ? current
                : [...current, incoming],
            );
          }
          void loadTickets();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadTickets, selectedTicketId, user]);

  const selectTicket = (ticketId: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("ticket", ticketId);
    next.delete("trip");
    setSearchParams(next);
    setShowNew(false);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = newTicketSchema.safeParse(form);
    if (!parsed.success) {
      const fields = parsed.error.flatten().fieldErrors;
      setErrors({
        subject: fields.subject?.[0] ?? "",
        category: fields.category?.[0] ?? "",
        message: fields.message?.[0] ?? "",
      });
      return;
    }

    if (!user) return;

    setErrors({});
    setSaving(true);

    const priority =
      parsed.data.category === "roadside" || parsed.data.category === "accident"
        ? "urgent"
        : "normal";

    const { data, error } = await supabase
      .from("support_tickets")
      .insert({
        user_id: user.id,
        subject: parsed.data.subject,
        category: parsed.data.category,
        body: parsed.data.message,
        trip_id: tripId,
        priority,
        status: "open",
      })
      .select("id")
      .single();

    setSaving(false);

    if (error || !data) {
      toast({
        title: "Could not send",
        description: error?.message ?? "Try again.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: priority === "urgent" ? "Urgent request opened" : "Request sent",
      description:
        priority === "urgent"
          ? "Your request is marked urgent for the Rentauto operations team."
          : "Your request is now in the Rentauto support queue.",
    });

    setForm({ subject: "", category: "", message: "" });
    setTripContext(null);
    setShowNew(false);
    await loadTickets();
    selectTicket(data.id);
  };

  const sendReply = async () => {
    if (!user || !selectedTicket || selectedTicket.status === "closed") return;
    const body = reply.trim();

    if (body.length < 1 || body.length > 4000) {
      toast({
        title: "Reply not sent",
        description: "Reply must be between 1 and 4000 characters.",
        variant: "destructive",
      });
      return;
    }

    setReplying(true);
    const { data, error } = await supabase
      .from("support_ticket_messages")
      .insert({
        ticket_id: selectedTicket.id,
        sender_user_id: user.id,
        sender_is_admin: false,
        body,
      })
      .select("*")
      .single();
    setReplying(false);

    if (error || !data) {
      toast({
        title: "Reply not sent",
        description: error?.message ?? "Try again.",
        variant: "destructive",
      });
      return;
    }

    setReply("");
    setMessages((current) =>
      current.some((message) => message.id === data.id)
        ? current
        : [...current, data],
    );
    await loadTickets();
  };

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Support"
        description="Secure support conversations linked to your account and trips."
      />

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setShowNew((current) => !current)}>
          <Plus className="mr-2 h-4 w-4" />
          New request
        </Button>
        <p className="self-center text-xs text-muted-foreground">
          For immediate danger or medical emergencies, contact local emergency services first.
        </p>
      </div>

      {showNew ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <LifeBuoy className="h-4 w-4 text-primary" />
              New support request
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tripContext ? (
              <div className="mb-4 rounded-lg border border-border bg-muted/40 p-3 text-sm">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  About this trip
                </p>
                <p className="mt-1 font-medium">{tripContext.vehicle}</p>
                <p className="text-xs text-muted-foreground">{tripContext.dates}</p>
                <p className="font-mono text-xs text-muted-foreground">
                  Booking {tripContext.reference}
                </p>
              </div>
            ) : null}

            <form onSubmit={submit} className="grid gap-4 md:grid-cols-2" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  value={form.subject}
                  maxLength={150}
                  onChange={(event) =>
                    setForm({ ...form, subject: event.target.value })
                  }
                  aria-invalid={Boolean(errors.subject)}
                />
                {errors.subject ? (
                  <p className="text-xs text-destructive">{errors.subject}</p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(value) => setForm({ ...form, category: value })}
                >
                  <SelectTrigger id="category" aria-invalid={Boolean(errors.category)}>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((category) => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.category ? (
                  <p className="text-xs text-destructive">{errors.category}</p>
                ) : null}
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="message">How can we help?</Label>
                <Textarea
                  id="message"
                  rows={5}
                  maxLength={4000}
                  value={form.message}
                  onChange={(event) =>
                    setForm({ ...form, message: event.target.value })
                  }
                  aria-invalid={Boolean(errors.message)}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{errors.message || "Give enough detail for the operations team to act."}</span>
                  <span>{form.message.length}/4000</span>
                </div>
              </div>

              {(form.category === "roadside" || form.category === "accident") ? (
                <div className="md:col-span-2 flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <p>
                    This request will be marked urgent. If anyone is unsafe, call emergency
                    services before using Rentauto support.
                  </p>
                </div>
              ) : null}

              <div className="md:col-span-2">
                <Button type="submit" disabled={saving}>
                  <Send className="mr-2 h-4 w-4" />
                  {saving ? "Sending…" : "Open request"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Your requests</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {tickets.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  icon={LifeBuoy}
                  title="No requests yet"
                  description="Open a support request when you need the Rentauto operations team."
                />
              </div>
            ) : (
              <div className="max-h-[650px] overflow-y-auto">
                {tickets.map((ticket) => (
                  <button
                    type="button"
                    key={ticket.id}
                    onClick={() => selectTicket(ticket.id)}
                    className={cn(
                      "w-full border-t border-border p-4 text-left transition-colors first:border-t-0 hover:bg-muted/50",
                      selectedTicketId === ticket.id && "bg-muted",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 truncate font-medium">{ticket.subject}</p>
                      <StatusBadge tone={TICKET_TONE[ticket.status] ?? "neutral"}>
                        {statusLabel(ticket.status)}
                      </StatusBadge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {ticket.body}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="capitalize">{ticket.priority}</span>
                      <span>
                        {format(
                          new Date(ticket.last_message_at ?? ticket.created_at),
                          "MMM d • HH:mm",
                        )}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="min-h-[460px]">
          {!selectedTicket ? (
            <CardContent className="flex min-h-[460px] items-center justify-center">
              <EmptyState
                icon={MessageSquare}
                title="Select a request"
                description="Choose a ticket to see the full support conversation."
              />
            </CardContent>
          ) : (
            <>
              <CardHeader className="border-b border-border">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">{selectedTicket.subject}</CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {selectedTicket.category.replace(/_/g, " ")} · opened{" "}
                      {format(new Date(selectedTicket.created_at), "MMM d, yyyy • HH:mm")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <StatusBadge tone={TICKET_TONE[selectedTicket.status] ?? "neutral"}>
                      {statusLabel(selectedTicket.status)}
                    </StatusBadge>
                    <span className="rounded-full border px-2 py-1 text-xs capitalize">
                      {selectedTicket.priority}
                    </span>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 p-4">
                {threadLoading ? (
                  <div className="flex min-h-[260px] items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="max-h-[420px] space-y-3 overflow-y-auto rounded-lg bg-muted/20 p-3">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={cn(
                          "flex",
                          message.sender_is_admin ? "justify-start" : "justify-end",
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
                            message.sender_is_admin
                              ? "rounded-bl-md border bg-background"
                              : "rounded-br-md bg-primary text-primary-foreground",
                          )}
                        >
                          <p className="whitespace-pre-wrap break-words">{message.body}</p>
                          <p
                            className={cn(
                              "mt-1 text-[10px]",
                              message.sender_is_admin
                                ? "text-muted-foreground"
                                : "text-primary-foreground/70",
                            )}
                          >
                            {message.sender_is_admin ? "Rentauto support · " : ""}
                            {format(new Date(message.created_at), "MMM d • HH:mm")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {selectedTicket.status === "closed" ? (
                  <p className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                    This request is closed. Open a new request if you need more help.
                  </p>
                ) : (
                  <div className="flex items-end gap-2">
                    <Textarea
                      value={reply}
                      onChange={(event) => setReply(event.target.value)}
                      maxLength={4000}
                      rows={2}
                      placeholder="Reply to Rentauto support"
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          void sendReply();
                        }
                      }}
                    />
                    <Button
                      size="icon"
                      className="h-11 w-11 shrink-0"
                      onClick={() => void sendReply()}
                      disabled={replying || !reply.trim()}
                      aria-label="Send support reply"
                    >
                      {replying ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
