import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ConciergeChat } from "./ConciergeChat";
import { useConciergeActions, useConciergeThreads } from "@/hooks/use-concierge";
import { useAuth } from "@/contexts/AuthContext";
import { Route, Maximize2 } from "lucide-react";

const HIDDEN_PREFIXES = [
  "/concierge",
  "/travel-planner",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
];

export function ConciergeLauncher() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const { data: threads } = useConciergeThreads();
  const { createThread } = useConciergeActions();

  useEffect(() => {
    if (!open || threadId || !user) return;
    if (threads && threads.length > 0) {
      setThreadId(threads[0].id);
      return;
    }
    if (!threads) return;
    void createThread().then(setThreadId);
  }, [open, threadId, threads, user, createThread]);

  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  return (
    <>
      <Button
        onClick={() => (user ? setOpen(true) : navigate(`/login?redirect=/concierge`))}
        aria-label="Open trip planning help"
        variant="secondary"
        className="fixed bottom-24 right-4 z-40 h-11 gap-2 rounded-full border border-border pl-4 pr-5 shadow-lg backdrop-blur md:bottom-6"
      >
        <Route className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Plan my trip</span>
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-md">
          <SheetHeader className="flex-row items-center justify-between space-y-0 border-b border-border p-4 pb-3">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Route className="h-4 w-4 text-primary" /> Trip assistant
            </SheetTitle>
            {threadId && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Open full trip planner"
                onClick={() => {
                  setOpen(false);
                  navigate(`/concierge/${threadId}`);
                }}
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            )}
          </SheetHeader>
          {threadId ? (
            <ConciergeChat key={threadId} threadId={threadId} compact className="min-h-0 flex-1" />
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              Getting ready…
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
