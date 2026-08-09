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
import { CompareProvider } from "./results/compare-context";
import { CompareBar } from "./results/CompareBar";
import { ConciergeToolResult, TOOL_STATUS } from "./results/ConciergeToolResult";
import { ArrowUp, Loader2, Route } from "lucide-react";

const QUICK_ASKS = [
  "7-seat SUV in Montreal under $90/day",
  "Best protection plan for a week",
  "Airport pickup at YUL next Friday",
  "Cheapest monthly rental",
];

interface ConciergeChatProps {
  threadId: string;
  seedPrompt?: string;
  className?: string;
  compact?: boolean;
}

export function ConciergeChat({ threadId, seedPrompt, className, compact }: ConciergeChatProps) {
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
        title: "Trip assistant unavailable",
        description: err.message.includes("429")
          ? "Too many requests right now — try again in a moment."
          : err.message.includes("402")
            ? "Service capacity is exhausted for this workspace."
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
    <CompareProvider>
      <div className={cn("flex min-h-0 flex-col", className)}>
        <div className="flex-1 space-y-6 overflow-y-auto px-4 py-5">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-14 w-2/3 rounded-2xl" />
              <Skeleton className="h-40 w-full rounded-2xl" />
            </div>
          ) : messages.length === 0 ? (
            <div className="space-y-5 py-4">
              <div className="space-y-1.5">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
                  <Route className="h-3.5 w-3.5" aria-hidden="true" /> Trip assistant
                </span>
                <h2 className="text-lg font-bold">Where are you headed?</h2>
                <p className="text-sm text-muted-foreground">
                  Describe the trip and Rentauto matches real vehicles, exact prices and pickup timing
                  across Quebec.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {QUICK_ASKS.map((s) => (
                  <button
                    key={s}
                    onClick={() => void sendMessage({ text: s })}
                    className="rounded-xl border border-border bg-card px-3 py-2.5 text-left text-sm transition-colors hover:border-primary/40 hover:bg-secondary/60"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                    {m.parts.map((p, i) =>
                      p.type === "text" ? (
                        <p key={i} className="whitespace-pre-wrap">
                          {p.text}
                        </p>
                      ) : null,
                    )}
                  </div>
                </div>
              ) : (
                <div key={m.id} className="space-y-3">
                  {m.parts.map((part, i) => {
                    if (part.type === "text") {
                      return (
                        <div
                          key={i}
                          className="prose prose-sm max-w-none text-foreground dark:prose-invert prose-p:my-2 prose-ul:my-2 prose-a:font-medium prose-a:text-primary"
                        >
                          <ReactMarkdown>{part.text}</ReactMarkdown>
                        </div>
                      );
                    }
                    if (part.type?.startsWith("tool-")) {
                      const name = part.type.replace("tool-", "");
                      const state = (part as { state?: string }).state;
                      if (state === "output-available") {
                        return (
                          <ConciergeToolResult
                            key={i}
                            toolName={name}
                            input={(part as any).input}
                            output={(part as any).output}
                          />
                        );
                      }
                      if (state === "output-error") return null;
                      return (
                        <p
                          key={i}
                          className="flex items-center gap-2 text-xs font-medium text-muted-foreground"
                        >
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                          {TOOL_STATUS[name] ?? "Working"}…
                        </p>
                      );
                    }
                    return null;
                  })}
                </div>
              ),
            )
          )}

          {status === "submitted" && (
            <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              Planning your trip…
            </p>
          )}
          <div ref={bottomRef} />
        </div>

        <CompareBar />

        <div className="border-t border-border p-3 pb-safe">
          {!compact && messages.length > 0 && (
            <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
              {QUICK_ASKS.slice(0, 3).map((s) => (
                <button
                  key={s}
                  onClick={() => void sendMessage({ text: s })}
                  disabled={busy}
                  className="shrink-0 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-1.5 focus-within:border-primary/40">
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
              placeholder="Montreal to Quebec City, 3 days, 4 people…"
              rows={1}
              className="max-h-32 min-h-[40px] resize-none border-0 bg-transparent px-2 py-2 shadow-none focus-visible:ring-0"
              aria-label="Describe your trip"
            />
            <Button
              size="icon"
              className="h-9 w-9 shrink-0 rounded-xl"
              onClick={submit}
              disabled={busy || !input.trim()}
              aria-label="Send"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </CompareProvider>
  );
}
