import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNowStrict } from "date-fns";
import { Bell, CheckCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { DashboardSkeleton } from "@/components/ui/skeletons";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { cn } from "@/lib/utils";

interface Notif {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export default function DashboardNotifications() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id, type, title, body, link, read_at, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (cancelled) return;
      setRows((data ?? []) as Notif[]);
      setLoading(false);
    })();

    const channel = supabase
      .channel("dashboard-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => setRows((prev) => [payload.new as Notif, ...prev]),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user]);

  const markAll = async () => {
    if (!user) return;
    const now = new Date().toISOString();
    setRows((prev) => prev.map((r) => (r.read_at ? r : { ...r, read_at: now })));
    await supabase.from("notifications").update({ read_at: now }).eq("user_id", user.id).is("read_at", null);
  };

  const markOne = async (id: string) => {
    const now = new Date().toISOString();
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, read_at: now } : r)));
    await supabase.from("notifications").update({ read_at: now }).eq("id", id);
  };

  if (loading) return <DashboardSkeleton />;

  const unread = rows.filter((r) => !r.read_at).length;

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Notifications"
        description={unread > 0 ? `${unread} unread update${unread > 1 ? "s" : ""}` : "You're all caught up."}
        actions={
          unread > 0 ? (
            <Button variant="outline" size="sm" onClick={markAll}>
              <CheckCheck className="mr-2 h-4 w-4" /> Mark all read
            </Button>
          ) : undefined
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications"
          description="Booking confirmations, payment receipts and trip reminders will show up here."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {rows.map((n) => {
                const content = (
                  <>
                    <span
                      className={cn(
                        "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                        n.read_at ? "bg-transparent" : "bg-primary",
                      )}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p className={cn("truncate", n.read_at ? "font-medium" : "font-semibold")}>{n.title}</p>
                      {n.body && <p className="text-sm text-muted-foreground">{n.body}</p>}
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatDistanceToNowStrict(new Date(n.created_at), { addSuffix: true })}
                        {!n.read_at && <span className="sr-only"> (unread)</span>}
                      </p>
                    </div>
                  </>
                );
                return (
                  <li key={n.id} onMouseEnter={() => !n.read_at && markOne(n.id)}>
                    {n.link ? (
                      <Link
                        to={n.link}
                        onClick={() => markOne(n.id)}
                        className="flex items-start gap-3 p-4 transition-colors hover:bg-muted/50"
                      >
                        {content}
                      </Link>
                    ) : (
                      <div className="flex items-start gap-3 p-4">{content}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
