import { useEffect } from "react";
import { useNavigate, useParams, useSearchParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ConciergeChat } from "@/components/concierge/ConciergeChat";
import { useConciergeThreads, useConciergeActions } from "@/hooks/use-concierge";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Plus, Sparkles, Trash2, Map } from "lucide-react";

export default function Concierge() {
  const { threadId } = useParams<{ threadId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { data: threads, isLoading } = useConciergeThreads();
  const { createThread, deleteThread } = useConciergeActions();

  const seedPrompt = searchParams.get("q") ?? undefined;

  // Land on a real thread URL
  useEffect(() => {
    if (threadId || !user || isLoading || !threads) return;
    if (threads.length > 0 && !seedPrompt) {
      navigate(`/concierge/${threads[0].id}`, { replace: true });
      return;
    }
    let cancelled = false;
    void createThread(seedPrompt).then((id) => {
      if (!cancelled) navigate(`/concierge/${id}${seedPrompt ? `?q=${encodeURIComponent(seedPrompt)}` : ""}`, { replace: true });
    });
    return () => {
      cancelled = true;
    };
  }, [threadId, user, threads, isLoading, seedPrompt, createThread, navigate]);

  if (!loading && !user) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4 text-center">
        <Sparkles className="h-8 w-8 text-primary" />
        <h1 className="text-xl font-bold">Sign in to use the Concierge</h1>
        <p className="text-sm text-muted-foreground max-w-sm">
          Your conversations and trip plans are saved to your account.
        </p>
        <Button onClick={() => navigate("/login?redirect=/concierge")}>Sign in</Button>
      </div>
    );
  }

  const newThread = async () => {
    const id = await createThread();
    navigate(`/concierge/${id}`);
  };

  return (
    <div className="min-h-dvh bg-background">
      <Helmet>
        <title>AI Rental Concierge — Rentauto.ca</title>
        <meta
          name="description"
          content="Chat with the Rentauto AI Concierge to find vehicles, compare protection plans, get exact trip quotes and plan your Canadian road trip."
        />
      </Helmet>

      <div className="mx-auto max-w-6xl grid md:grid-cols-[260px_1fr] gap-0 md:gap-4 md:py-6 md:px-4">
        {/* Thread list */}
        <aside className="border-b md:border md:rounded-2xl border-border bg-card md:h-[calc(100dvh-8rem)] flex flex-col">
          <div className="p-3 flex gap-2">
            <Button onClick={newThread} className="flex-1 rounded-xl" size="sm">
              <Plus className="h-4 w-4 mr-1" /> New chat
            </Button>
            <Button asChild variant="outline" size="sm" className="rounded-xl" aria-label="Travel planner">
              <Link to="/travel-planner">
                <Map className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto md:overflow-y-auto px-2 pb-2 flex md:block gap-2 overflow-x-auto">
            {isLoading ? (
              <Skeleton className="h-10 w-full rounded-xl" />
            ) : (
              (threads ?? []).map((t) => (
                <div
                  key={t.id}
                  className={cn(
                    "group flex items-center gap-1 rounded-xl px-2 md:px-3 py-2 text-sm shrink-0 md:shrink",
                    t.id === threadId ? "bg-secondary" : "hover:bg-secondary/60",
                  )}
                >
                  <button
                    onClick={() => navigate(`/concierge/${t.id}`)}
                    className="flex-1 text-left truncate max-w-[180px]"
                  >
                    {t.title}
                  </button>
                  <button
                    onClick={() => {
                      deleteThread.mutate(t.id, {
                        onSuccess: () => {
                          if (t.id === threadId) navigate("/concierge", { replace: true });
                        },
                      });
                    }}
                    aria-label={`Delete ${t.title}`}
                    className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Chat */}
        <section className="md:border md:rounded-2xl border-border bg-card flex flex-col h-[calc(100dvh-8rem)]">
          {threadId ? (
            <ConciergeChat key={threadId} threadId={threadId} seedPrompt={seedPrompt} className="flex-1" />
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Starting a conversation…
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
