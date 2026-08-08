import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useConciergeMessages } from "@/hooks/use-concierge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Loader2, Send, Sparkles, Wrench } from "lucide-react";

const SUGGESTIONS = [
  "Find me a 7-seat SUV in Montreal under $90/day",
  "What protection plan should I pick for a week-long trip?",
  "How does GPS tracking privacy work?",
  "I want to list my car — what do I need?",
];

const TOOL_LABELS: Record<string, string> = {
  search_vehicles: "Searching live inventory",
  get_vehicle: "Reading vehicle details",
  quote_trip: "Calculating an exact quote",
  list_protection_plans: "Checking protection plans",
  list_cancellation_policies: "Checking cancellation policies",
  platform_knowledge: "Checking Rentauto policy",
  my_trips: "Looking up your bookings",
};

interface ConciergeChatProps {
  threadId: string;
  seedPrompt?: string;
  className?: string;
}

export function ConciergeChat({ threadId, seedPrompt, className }: ConciergeChatProps) {
  const { toast } = useToast();
  const { data: initialMessages, isLoading } = useConciergeMessages(threadId);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const seeded = useRef<string | null>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport<UIMessage>({
        api: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/concierge`,
        headers: async () => {
          const { data } = await supabase.auth.getSession();
          return {
            Authorization: `Bearer ${data.session?.access_token ?? ""}`,
            "Content-Type": "application/json",
          };
        },
        body: { threadId },
      }),
    [threadId],
  );

  const { messages, sendMessage, status, setMessages } = useChat<UIMessage>({
    id: threadId,
    transport,
    onError: (err) =>
      toast({
        title: "Concierge unavailable",
        description: err.message.includes("429")
          ? "Too many requests right now — try again in a moment."
          : err.message.includes("402")
            ? "AI credits are exhausted for this workspace."
            : err.message || "Something went wrong.",
        variant: "destructive",
      }),
  });

  useEffect(() => {
    if (initialMessages && initialMessages.length > 0) setMessages(initialMessages);
  }, [initialMessages, setMessages]);

  useEffect(() => {
    if (!seedPrompt || isLoading) return;
    if (seeded.current === threadId) return;
    if ((initialMessages?.length ?? 0) > 0) return;
    seeded.current = threadId;
    void sendMessage({ text: seedPrompt });
  }, [seedPrompt, threadId, isLoading, initialMessages, sendMessage]);

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status]);

  useEffect(() => {
    if (!busy) inputRef.current?.focus();
  }, [busy, threadId]);

  const submit = () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    void sendMessage({ text });
  };

  return (
    <div className={cn("flex flex-col min-h-0", className)}>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-3/4 rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
          </div>
        ) : messages.length === 0 ? (
          <div className="space-y-4 py-6">
            <div className="flex items-center gap-2 text-primary">
              <Sparkles className="h-5 w-5" />
              <span className="font-semibold">Rentauto Concierge</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Ask about vehicles, pricing, protection, tracking or hosting. I search live inventory and
              use the real quote engine.
            </p>
            <div className="grid gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => void sendMessage({ text: s })}
                  className="text-left text-sm rounded-xl border border-border px-3 py-2 hover:bg-secondary/60 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-3 text-sm",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary/70 text-foreground",
                )}
              >
                {m.parts.map((part, i) => {
                  if (part.type === "text") {
                    return m.role === "user" ? (
                      <p key={i} className="whitespace-pre-wrap">
                        {part.text}
                      </p>
                    ) : (
                      <div
                        key={i}
                        className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-ul:my-2 prose-a:text-primary"
                      >
                        <ReactMarkdown>{part.text}</ReactMarkdown>
                      </div>
                    );
                  }
                  if (part.type?.startsWith("tool-")) {
                    const name = part.type.replace("tool-", "");
                    const state = (part as { state?: string }).state;
                    if (state === "output-available" || state === "output-error") return null;
                    return (
                      <p key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Wrench className="h-3.5 w-3.5 animate-pulse" />
                        {TOOL_LABELS[name] ?? "Working"}…
                      </p>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          ))
        )}
        {status === "submitted" && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-secondary/70 px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border p-3 pb-safe">
        <div className="flex items-end gap-2">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Ask the concierge…"
            rows={1}
            className="min-h-[44px] max-h-32 resize-none rounded-xl"
            aria-label="Message the concierge"
          />
          <Button
            size="icon"
            className="h-11 w-11 rounded-xl shrink-0"
            onClick={submit}
            disabled={busy || !input.trim()}
            aria-label="Send message"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
