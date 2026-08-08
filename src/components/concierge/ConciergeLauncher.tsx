import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ConciergeChat } from "./ConciergeChat";
import { useConciergeActions, useConciergeThreads } from "@/hooks/use-concierge";
import { useAuth } from "@/contexts/AuthContext";
import { Sparkles, Maximize2 } from "lucide-react";

const HIDDEN_PREFIXES = ["/concierge", "/login", "/signup", "/forgot-password", "/reset-password", "/verify-email"];

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
        aria-label="Open the AI concierge"
        className="fixed right-4 bottom-24 md:bottom-6 z-40 h-12 rounded-full shadow-lg gap-2 pl-4 pr-5"
      >
        <Sparkles className="h-4 w-4" />
        <span className="text-sm font-semibold">Concierge</span>
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
          <SheetHeader className="p-4 pb-2 flex-row items-center justify-between space-y-0">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" /> Rentauto Concierge
            </SheetTitle>
            {threadId && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Open full concierge page"
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
            <ConciergeChat key={threadId} threadId={threadId} className="flex-1 min-h-0" />
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Starting…
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
