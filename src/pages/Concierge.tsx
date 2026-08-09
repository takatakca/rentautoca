import { useNavigate, useParams, useSearchParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ConciergeChat } from "@/components/concierge/ConciergeChat";
import { useConciergeThreads, useConciergeActions } from "@/hooks/use-concierge";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ArrowRight,
  CalendarRange,
  Car,
  MapPinned,
  Plane,
  Plus,
  Route,
  ShieldCheck,
  Trash2,
} from "lucide-react";

const ACTIONS = [
  {
    icon: Car,
    title: "Find the right vehicle",
    body: "Match live inventory to your dates, seats and budget.",
    prompt: "Help me find the right vehicle. I'll tell you my city, dates and how many people.",
  },
  {
    icon: MapPinned,
    title: "Plan a road trip",
    body: "Route, driving time and the car that suits it.",
    prompt: "I'm planning a road trip in Quebec. Suggest a route and the best vehicle for it.",
  },
  {
    icon: Plane,
    title: "Airport pickup",
    body: "YUL, YQB and YHU handover timing.",
    prompt: "I land at YUL and need a car. What are my airport pickup options and timing?",
  },
  {
    icon: ShieldCheck,
    title: "Compare protection",
    body: "Deductibles and coverage, side by side.",
    prompt: "Compare the protection plans and recommend one for a week-long trip.",
  },
  {
    icon: CalendarRange,
    title: "Monthly rental",
    body: "Long-stay pricing with the biggest discount.",
    prompt: "I need a car for about a month. What are my cheapest monthly options?",
  },
  {
    icon: Route,
    title: "Manage my trip",
    body: "Pickup details, changes and cancellation terms.",
    prompt: "Show my bookings and explain what I can change before pickup.",
  },
];

export default function Concierge() {
  const { threadId } = useParams<{ threadId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { data: threads, isLoading } = useConciergeThreads();
  const { createThread, deleteThread } = useConciergeActions();

  const seedPrompt = searchParams.get("q") ?? undefined;

  if (!authLoading && !user) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <Route className="h-8 w-8 text-primary" />
        <h1 className="text-xl font-bold">Sign in to plan your trip</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Your plans, quotes and saved vehicles stay with your account.
        </p>
        <Button onClick={() => navigate("/login?redirect=/concierge")}>Sign in</Button>
      </div>
    );
  }

  const start = async (prompt?: string, label?: string) => {
    const id = await createThread(label ?? prompt);
    navigate(`/concierge/${id}${prompt ? `?q=${encodeURIComponent(prompt)}` : ""}`);
  };

  const meta = (
    <Helmet>
      <title>Trip Planning Assistant — Rentauto.ca</title>
      <meta
        name="description"
        content="Plan your Canadian trip with Rentauto: real vehicles, exact prices, protection guidance and pickup timing in one place."
      />
    </Helmet>
  );

  const recent = (
    <div className="space-y-1">
      {isLoading ? (
        <Skeleton className="h-10 w-full rounded-xl" />
      ) : (threads ?? []).length === 0 ? (
        <p className="px-1 text-xs text-muted-foreground">No plans yet.</p>
      ) : (
        (threads ?? []).map((t) => (
          <div
            key={t.id}
            className={cn(
              "group flex items-center gap-1 rounded-xl px-3 py-2 text-sm",
              t.id === threadId ? "bg-secondary" : "hover:bg-secondary/60",
            )}
          >
            <button
              onClick={() => navigate(`/concierge/${t.id}`)}
              className="min-w-0 flex-1 truncate text-left"
            >
              {t.title}
            </button>
            <button
              onClick={() =>
                deleteThread.mutate(t.id, {
                  onSuccess: () => {
                    if (t.id === threadId) navigate("/concierge", { replace: true });
                  },
                })
              }
              aria-label={`Delete ${t.title}`}
              className="text-muted-foreground opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100 hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))
      )}
    </div>
  );

  // ---------- Command centre ----------
  if (!threadId) {
    return (
      <div className="min-h-dvh bg-background">
        {meta}
        <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
          <header className="space-y-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
              <Route className="h-3.5 w-3.5" /> Trip planning
            </span>
            <h1 className="text-3xl font-bold tracking-tight">Tell us the trip. We'll handle the car.</h1>
            <p className="max-w-xl text-sm text-muted-foreground">
              Real vehicles from Rentauto hosts, exact prices from our booking engine, and pickup advice
              for every city we serve.
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={() => start()} className="rounded-xl">
                <Plus className="mr-1 h-4 w-4" /> Start a new plan
              </Button>
              <Button asChild variant="outline" className="rounded-xl">
                <Link to="/travel-planner">
                  Use the trip builder <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </header>

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ACTIONS.map((a) => (
              <button
                key={a.title}
                onClick={() => start(a.prompt, a.title)}
                className="group rounded-2xl border border-border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
              >
                <a.icon className="h-5 w-5 text-primary" aria-hidden="true" />
                <h2 className="mt-3 text-sm font-semibold">{a.title}</h2>
                <p className="mt-1 text-xs leading-snug text-muted-foreground">{a.body}</p>
              </button>
            ))}
          </section>

          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Recent plans
            </h2>
            <div className="rounded-2xl border border-border bg-card p-2">{recent}</div>
          </section>
        </div>
      </div>
    );
  }

  // ---------- Conversation ----------
  return (
    <div className="min-h-dvh bg-background">
      {meta}
      <div className="mx-auto grid max-w-6xl gap-0 md:grid-cols-[250px_1fr] md:gap-4 md:px-4 md:py-6">
        <aside className="hidden flex-col rounded-2xl border border-border bg-card md:flex md:h-[calc(100dvh-8rem)]">
          <div className="p-3">
            <Button onClick={() => start()} size="sm" className="w-full rounded-xl">
              <Plus className="mr-1 h-4 w-4" /> New plan
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-2">{recent}</div>
        </aside>

        <section className="flex h-[calc(100dvh-8rem)] flex-col border-border bg-card md:rounded-2xl md:border">
          <header className="flex items-center gap-2 border-b border-border px-3 py-2.5">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label="Back to trip planning"
              onClick={() => navigate("/concierge")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <span className="truncate text-sm font-semibold">
              {threads?.find((t) => t.id === threadId)?.title ?? "Your trip plan"}
            </span>
            <Button asChild variant="ghost" size="sm" className="ml-auto text-xs">
              <Link to="/travel-planner">Trip builder</Link>
            </Button>
          </header>
          <ConciergeChat key={threadId} threadId={threadId} seedPrompt={seedPrompt} className="flex-1" />
        </section>
      </div>
    </div>
  );
}
