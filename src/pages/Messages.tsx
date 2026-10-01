import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { format, formatDistanceToNowStrict } from "date-fns";
import {
  ArrowUpRight,
  Car,
  CheckCheck,
  Loader2,
  MessageSquare,
  Search,
  Send,
  UserRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

type TripMessage = Tables<"trip_messages">;

type TripRow = {
  id: string;
  car_id: string;
  guest_id: string;
  booking_reference: string;
  status: string;
  start_at: string;
  end_at: string;
};

type CarRow = {
  id: string;
  host_id: string;
  title: string;
  make: string;
  model: string;
  year: number;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
};

type Conversation = {
  trip: TripRow;
  car: CarRow;
  counterpartId: string;
  counterpartLabel: string;
  userSide: "guest" | "host";
  unreadCount: number;
  lastMessage: TripMessage | null;
};

const MESSAGEABLE_EXCLUDED = new Set(["draft", "pending_payment"]);

function vehicleLabel(car: CarRow) {
  return car.title?.trim() || `${car.year} ${car.make} ${car.model}`;
}

function personLabel(profile: ProfileRow | undefined, fallback: string) {
  if (profile?.display_name?.trim()) return profile.display_name.trim();
  const full = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim();
  return full || fallback;
}

export default function Messages() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [cars, setCars] = useState<Record<string, CarRow>>({});
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({});
  const [messages, setMessages] = useState<TripMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data: ownedCars } = await supabase
      .from("cars")
      .select("id,host_id,title,make,model,year")
      .eq("host_id", user.id);

    const hostCarIds = (ownedCars ?? []).map((car) => car.id);

    const guestPromise = supabase
      .from("trips")
      .select("id,car_id,guest_id,booking_reference,status,start_at,end_at")
      .eq("guest_id", user.id)
      .order("start_at", { ascending: false });

    const hostPromise = hostCarIds.length
      ? supabase
          .from("trips")
          .select("id,car_id,guest_id,booking_reference,status,start_at,end_at")
          .in("car_id", hostCarIds)
          .order("start_at", { ascending: false })
      : Promise.resolve({ data: [] as TripRow[], error: null });

    const [guestResult, hostResult] = await Promise.all([guestPromise, hostPromise]);
    const byTrip = new Map<string, TripRow>();

    for (const trip of [...(guestResult.data ?? []), ...(hostResult.data ?? [])]) {
      if (!MESSAGEABLE_EXCLUDED.has(trip.status)) byTrip.set(trip.id, trip as TripRow);
    }

    const tripRows = [...byTrip.values()];
    const allCarIds = [...new Set(tripRows.map((trip) => trip.car_id))];
    const carMap: Record<string, CarRow> = {};

    for (const car of ownedCars ?? []) carMap[car.id] = car as CarRow;

    const missingCarIds = allCarIds.filter((id) => !carMap[id]);
    if (missingCarIds.length) {
      const { data: missingCars } = await supabase
        .from("cars")
        .select("id,host_id,title,make,model,year")
        .in("id", missingCarIds);
      for (const car of missingCars ?? []) carMap[car.id] = car as CarRow;
    }

    const counterpartIds = [
      ...new Set(
        tripRows
          .map((trip) => {
            const car = carMap[trip.car_id];
            if (!car) return null;
            return trip.guest_id === user.id ? car.host_id : trip.guest_id;
          })
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const profileMap: Record<string, ProfileRow> = {};
    if (counterpartIds.length) {
      const { data: profileRows } = await supabase
        .from("profiles")
        .select("id,display_name,first_name,last_name")
        .in("id", counterpartIds);
      for (const profile of profileRows ?? []) profileMap[profile.id] = profile as ProfileRow;
    }

    let messageRows: TripMessage[] = [];
    if (tripRows.length) {
      const { data } = await supabase
        .from("trip_messages")
        .select("*")
        .in("trip_id", tripRows.map((trip) => trip.id))
        .order("created_at", { ascending: true });
      messageRows = data ?? [];
    }

    setTrips(tripRows);
    setCars(carMap);
    setProfiles(profileMap);
    setMessages(messageRows);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`trip-messages-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "rentauto", table: "trip_messages" },
        (payload) => {
          const incoming = payload.new as TripMessage;
          if (
            incoming.sender_user_id !== user.id &&
            incoming.recipient_user_id !== user.id
          ) return;
          setMessages((current) =>
            current.some((message) => message.id === incoming.id)
              ? current
              : [...current, incoming],
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user]);

  const conversations = useMemo<Conversation[]>(() => {
    if (!user) return [];

    return trips
      .map((trip) => {
        const car = cars[trip.car_id];
        if (!car) return null;

        const userSide = trip.guest_id === user.id ? "guest" : "host";
        const counterpartId = userSide === "guest" ? car.host_id : trip.guest_id;
        const threadMessages = messages.filter((message) => message.trip_id === trip.id);
        const lastMessage = threadMessages.at(-1) ?? null;
        const unreadCount = threadMessages.filter(
          (message) =>
            message.recipient_user_id === user.id && message.read_at === null,
        ).length;

        return {
          trip,
          car,
          counterpartId,
          counterpartLabel: personLabel(
            profiles[counterpartId],
            userSide === "guest" ? "Host" : "Guest",
          ),
          userSide,
          unreadCount,
          lastMessage,
        } satisfies Conversation;
      })
      .filter((conversation): conversation is Conversation => conversation !== null)
      .sort((a, b) => {
        const aTime = new Date(a.lastMessage?.created_at ?? a.trip.start_at).getTime();
        const bTime = new Date(b.lastMessage?.created_at ?? b.trip.start_at).getTime();
        return bTime - aTime;
      });
  }, [cars, messages, profiles, trips, user]);

  const selectedTripId = searchParams.get("trip");
  const selected =
    conversations.find((conversation) => conversation.trip.id === selectedTripId) ??
    conversations[0] ??
    null;

  const selectedMessages = useMemo(
    () =>
      selected
        ? messages.filter((message) => message.trip_id === selected.trip.id)
        : [],
    [messages, selected],
  );

  const visibleConversations = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return conversations;
    return conversations.filter((conversation) =>
      [
        conversation.counterpartLabel,
        vehicleLabel(conversation.car),
        conversation.trip.booking_reference,
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [conversations, query]);

  const markSelectedRead = useCallback(async () => {
    if (!user || !selected) return;
    const unreadIds = messages
      .filter(
        (message) =>
          message.trip_id === selected.trip.id &&
          message.recipient_user_id === user.id &&
          message.read_at === null,
      )
      .map((message) => message.id);
    if (!unreadIds.length) return;

    const readAt = new Date().toISOString();
    setMessages((current) =>
      current.map((message) =>
        unreadIds.includes(message.id) ? { ...message, read_at: readAt } : message,
      ),
    );

    const { error } = await supabase
      .from("trip_messages")
      .update({ read_at: readAt })
      .in("id", unreadIds)
      .eq("recipient_user_id", user.id);

    if (error) {
      void load();
    }
  }, [load, messages, selected, user]);

  useEffect(() => {
    void markSelectedRead();
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
  }, [selected?.trip.id, selectedMessages.length]);

  const selectConversation = (tripId: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("trip", tripId);
    setSearchParams(next);
  };

  const sendMessage = async () => {
    if (!user || !selected || sending) return;
    const body = draft.trim();
    if (!body) return;

    setSending(true);
    const clientMessageId = crypto.randomUUID();
    const { data, error } = await supabase
      .from("trip_messages")
      .insert({
        trip_id: selected.trip.id,
        sender_user_id: user.id,
        recipient_user_id: selected.counterpartId,
        client_message_id: clientMessageId,
        body,
      })
      .select("*")
      .single();
    setSending(false);

    if (error || !data) {
      toast({
        title: "Message not sent",
        description: error?.message ?? "Try again.",
        variant: "destructive",
      });
      return;
    }

    setDraft("");
    setMessages((current) =>
      current.some((message) => message.id === data.id)
        ? current
        : [...current, data],
    );
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
  };

  if (loading) {
    return (
      <div className="container flex min-h-[55vh] items-center justify-center py-8">
        <Loader2 className="h-7 w-7 animate-spin text-primary" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="container py-6 pb-24 md:py-8 md:pb-8">
      <div className="mb-5">
        <p className="text-sm font-medium text-primary">Trips & communication</p>
        <h1 className="text-3xl font-bold tracking-tight">Messages</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          One secure conversation per confirmed booking between guest and host.
        </p>
      </div>

      {conversations.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No conversations yet"
          description="A secure host–guest thread appears here after a booking is confirmed."
          action={{ label: "Browse vehicles", href: "/explore" }}
        />
      ) : (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="grid min-h-[620px] lg:grid-cols-[330px_minmax(0,1fr)]">
              <aside className="border-b border-border lg:border-b-0 lg:border-r">
                <div className="border-b border-border p-3">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search conversations"
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="max-h-[260px] overflow-y-auto lg:max-h-[560px]">
                  {visibleConversations.map((conversation) => (
                    <button
                      key={conversation.trip.id}
                      type="button"
                      onClick={() => selectConversation(conversation.trip.id)}
                      className={cn(
                        "flex w-full gap-3 border-b border-border p-4 text-left transition-colors hover:bg-muted/50",
                        selected?.trip.id === conversation.trip.id && "bg-muted",
                      )}
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <UserRound className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate font-semibold">{conversation.counterpartLabel}</span>
                          {conversation.unreadCount > 0 ? (
                            <span className="flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
                              {conversation.unreadCount}
                            </span>
                          ) : null}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {vehicleLabel(conversation.car)}
                        </span>
                        <span className="mt-1 block truncate text-xs text-muted-foreground">
                          {conversation.lastMessage?.body ?? "Start the conversation"}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </aside>

              {selected ? (
                <section className="flex min-w-0 flex-col">
                  <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
                    <div className="min-w-0">
                      <p className="font-semibold">{selected.counterpartLabel}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {vehicleLabel(selected.car)} · {selected.trip.booking_reference}
                      </p>
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/trips/${selected.trip.id}`}>
                        View trip <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </header>

                  <div className="flex-1 space-y-3 overflow-y-auto bg-muted/20 p-4">
                    <div className="mx-auto mb-5 max-w-sm rounded-lg border border-border bg-background px-3 py-2 text-center text-xs text-muted-foreground">
                      <Car className="mx-auto mb-1 h-4 w-4" />
                      {format(new Date(selected.trip.start_at), "MMM d, yyyy")} →{" "}
                      {format(new Date(selected.trip.end_at), "MMM d, yyyy")}
                    </div>

                    {selectedMessages.length === 0 ? (
                      <div className="py-16 text-center">
                        <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground/50" />
                        <p className="mt-3 font-medium">Start the conversation</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Coordinate pickup, return, questions and trip details here.
                        </p>
                      </div>
                    ) : (
                      selectedMessages.map((message) => {
                        const mine = message.sender_user_id === user?.id;
                        return (
                          <div
                            key={message.id}
                            className={cn("flex", mine ? "justify-end" : "justify-start")}
                          >
                            <div
                              className={cn(
                                "max-w-[82%] rounded-2xl px-4 py-2.5 text-sm shadow-sm",
                                mine
                                  ? "rounded-br-md bg-primary text-primary-foreground"
                                  : "rounded-bl-md border border-border bg-background",
                              )}
                            >
                              <p className="whitespace-pre-wrap break-words">{message.body}</p>
                              <p
                                className={cn(
                                  "mt-1 flex items-center justify-end gap-1 text-[10px]",
                                  mine ? "text-primary-foreground/70" : "text-muted-foreground",
                                )}
                              >
                                {format(new Date(message.created_at), "h:mm a")}
                                {mine && message.read_at ? (
                                  <>
                                    <CheckCheck className="h-3 w-3" />
                                    Read
                                  </>
                                ) : null}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={bottomRef} />
                  </div>

                  <div className="border-t border-border bg-background p-3">
                    <div className="flex items-end gap-2">
                      <Textarea
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            void sendMessage();
                          }
                        }}
                        placeholder={`Message ${selected.counterpartLabel}`}
                        maxLength={4000}
                        rows={2}
                        className="min-h-[44px] resize-none"
                      />
                      <Button
                        size="icon"
                        className="h-11 w-11 shrink-0"
                        disabled={sending || !draft.trim()}
                        onClick={() => void sendMessage()}
                        aria-label="Send message"
                      >
                        {sending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Enter to send · Shift+Enter for a new line · {draft.length}/4000
                    </p>
                  </div>
                </section>
              ) : null}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
