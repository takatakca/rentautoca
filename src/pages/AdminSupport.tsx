import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { ArrowLeft, LifeBuoy, Loader2, RefreshCw, Send } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

type Ticket = Tables<"support_tickets">;
type Message = Tables<"support_ticket_messages">;
type Profile = Pick<Tables<"profiles">, "id" | "display_name" | "first_name" | "last_name" | "phone">;

const STATUSES = ["open", "in_progress", "waiting_customer", "resolved", "closed"] as const;
const PRIORITIES = ["low", "normal", "high", "urgent"] as const;

function profileName(profile: Profile | undefined, userId: string) {
  if (profile?.display_name?.trim()) return profile.display_name.trim();
  const full = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim();
  return full || `Customer ${userId.slice(0, 8)}`;
}

function statusLabel(status: string) {
  if (status === "waiting_customer") return "waiting on customer";
  return status.replace(/_/g, " ");
}

export default function AdminSupport() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get("ticket");

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [messages, setMessages] = useState<Message[]>([]);
  const [filter, setFilter] = useState("active");
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [replying, setReplying] = useState(false);
  const [updating, setUpdating] = useState(false);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("support_tickets")
      .select("*")
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(200);

    if (filter === "active") {
      query = query.in("status", ["open", "in_progress", "waiting_customer"]);
    } else if (filter !== "all") {
      query = query.eq("status", filter);
    }

    const { data, error } = await query;
    if (error) {
      toast({ title: "Support queue unavailable", description: error.message, variant: "destructive" });
      setTickets([]);
      setLoading(false);
      return;
    }

    const rows = data ?? [];
    rows.sort((a, b) => {
      const rank: Record<string, number> = { urgent: 4, high: 3, normal: 2, low: 1 };
      return (rank[b.priority] ?? 0) - (rank[a.priority] ?? 0);
    });
    setTickets(rows);

    const ids = [...new Set(rows.map((ticket) => ticket.user_id))];
    if (ids.length) {
      const { data: profileRows } = await supabase
        .from("profiles")
        .select("id,display_name,first_name,last_name,phone")
        .in("id", ids);
      const map: Record<string, Profile> = {};
      for (const profile of profileRows ?? []) map[profile.id] = profile;
      setProfiles(map);
    } else {
      setProfiles({});
    }
    setLoading(false);
  }, [filter, toast]);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  const selected = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedId) ?? null,
    [selectedId, tickets],
  );

  const loadMessages = useCallback(async () => {
    if (!selectedId || !user) {
      setMessages([]);
      return;
    }

    setThreadLoading(true);
    const { data, error } = await supabase
      .from("support_ticket_messages")
      .select("*")
      .eq("ticket_id", selectedId)
      .order("created_at", { ascending: true });

    if (error) {
      toast({ title: "Conversation unavailable", description: error.message, variant: "destructive" });
      setMessages([]);
      setThreadLoading(false);
      return;
    }

    const rows = data ?? [];
    setMessages(rows);
    setThreadLoading(false);

    const unread = rows
      .filter((message) => !message.sender_is_admin && message.read_at === null)
      .map((message) => message.id);

    if (unread.length) {
      await supabase
        .from("support_ticket_messages")
        .update({ read_at: new Date().toISOString() })
        .in("id", unread);
    }
  }, [selectedId, toast, user]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("rentauto-admin-support")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "rentauto", table: "support_ticket_messages" },
        (payload) => {
          const incoming = payload.new as Message;
          if (incoming.ticket_id === selectedId) {
            setMessages((current) =>
              current.some((message) => message.id === incoming.id) ? current : [...current, incoming],
            );
          }
          void loadTickets();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadTickets, selectedId, user]);

  const chooseTicket = (id: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("ticket", id);
    setSearchParams(next);
  };

  const patchTicket = async (patch: Partial<Pick<Ticket, "status" | "priority">>) => {
    if (!selected) return;
    setUpdating(true);
    const { error } = await supabase.from("support_tickets").update(patch).eq("id", selected.id);
    setUpdating(false);

    if (error) {
      toast({ title: "Ticket not updated", description: error.message, variant: "destructive" });
      return;
    }
    await loadTickets();
  };

  const sendReply = async () => {
    if (!user || !selected || selected.status === "closed") return;
    const body = reply.trim();
    if (!body || body.length > 4000) return;

    setReplying(true);
    const { data, error } = await supabase
      .from("support_ticket_messages")
      .insert({
        ticket_id: selected.id,
        sender_user_id: user.id,
        sender_is_admin: true,
        body,
      })
      .select("*")
      .single();
    setReplying(false);

    if (error || !data) {
      toast({ title: "Reply not sent", description: error?.message ?? "Try again.", variant: "destructive" });
      return;
    }

    setReply("");
    setMessages((current) =>
      current.some((message) => message.id === data.id) ? current : [...current, data],
    );
    await loadTickets();
  };

  const urgent = tickets.filter((ticket) => ticket.priority === "urgent").length;

  return (
    <div className="container max-w-7xl space-y-6 py-8 pb-24">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/admin" className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Admin control center
          </Link>
          <h1 className="text-3xl font-bold">Support operations</h1>
          <p className="mt-1 text-muted-foreground">Customer requests, urgent roadside cases and secure conversation history.</p>
        </div>
        <Button variant="outline" onClick={() => void loadTickets()} disabled={loading}>
          <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} /> Refresh
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="pt-5"><p className="text-sm text-muted-foreground">Visible queue</p><p className="text-3xl font-bold">{tickets.length}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-sm text-muted-foreground">Urgent</p><p className="text-3xl font-bold">{urgent}</p></CardContent></Card>
        <Card><CardContent className="pt-5">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active requests</SelectItem>
              {STATUSES.map((status) => <SelectItem key={status} value={status}>{statusLabel(status)}</SelectItem>)}
              <SelectItem value="all">All requests</SelectItem>
            </SelectContent>
          </Select>
        </CardContent></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <CardHeader><CardTitle className="text-base">Queue</CardTitle></CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : tickets.length === 0 ? (
              <div className="p-5"><EmptyState icon={LifeBuoy} title="Queue clear" description="No support requests match this filter." /></div>
            ) : (
              <div className="max-h-[680px] overflow-y-auto">
                {tickets.map((ticket) => (
                  <button
                    type="button"
                    key={ticket.id}
                    onClick={() => chooseTicket(ticket.id)}
                    className={cn(
                      "w-full border-t p-4 text-left first:border-t-0 hover:bg-muted/50",
                      selectedId === ticket.id && "bg-muted",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate font-medium">{ticket.subject}</p>
                      <Badge variant={ticket.priority === "urgent" ? "destructive" : "outline"}>{ticket.priority}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{profileName(profiles[ticket.user_id], ticket.user_id)}</p>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{statusLabel(ticket.status)}</span>
                      <span>{format(new Date(ticket.last_message_at ?? ticket.created_at), "MMM d • HH:mm")}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="min-h-[520px]">
          {!selected ? (
            <CardContent className="flex min-h-[520px] items-center justify-center">
              <EmptyState icon={LifeBuoy} title="Select a request" description="Open a support ticket to review and respond." />
            </CardContent>
          ) : (
            <>
              <CardHeader className="border-b">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>{selected.subject}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {profileName(profiles[selected.user_id], selected.user_id)}
                      {profiles[selected.user_id]?.phone ? ` · ${profiles[selected.user_id].phone}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selected.category.replace(/_/g, " ")} · opened {format(new Date(selected.created_at), "MMM d, yyyy • HH:mm")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Select value={selected.priority} onValueChange={(priority) => void patchTicket({ priority })} disabled={updating}>
                      <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                      <SelectContent>{PRIORITIES.map((priority) => <SelectItem key={priority} value={priority}>{priority}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={selected.status} onValueChange={(status) => void patchTicket({ status })} disabled={updating}>
                      <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUSES.map((status) => <SelectItem key={status} value={status}>{statusLabel(status)}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 p-4">
                {threadLoading ? (
                  <div className="flex min-h-[300px] items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
                ) : (
                  <div className="max-h-[430px] space-y-3 overflow-y-auto rounded-lg bg-muted/20 p-3">
                    {messages.map((message) => (
                      <div key={message.id} className={cn("flex", message.sender_is_admin ? "justify-end" : "justify-start")}>
                        <div className={cn(
                          "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
                          message.sender_is_admin ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md border bg-background",
                        )}>
                          <p className="whitespace-pre-wrap break-words">{message.body}</p>
                          <p className={cn("mt-1 text-[10px]", message.sender_is_admin ? "text-primary-foreground/70" : "text-muted-foreground")}>
                            {message.sender_is_admin ? "Rentauto support · " : "Customer · "}
                            {format(new Date(message.created_at), "MMM d • HH:mm")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {selected.status === "closed" ? (
                  <p className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                    This case is closed. Change the status before replying.
                  </p>
                ) : (
                  <div className="flex items-end gap-2">
                    <Textarea
                      rows={3}
                      maxLength={4000}
                      value={reply}
                      onChange={(event) => setReply(event.target.value)}
                      placeholder="Reply as Rentauto support"
                    />
                    <Button className="h-11 shrink-0" onClick={() => void sendReply()} disabled={replying || !reply.trim()}>
                      {replying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                      Send
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
