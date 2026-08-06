import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  CalendarDays,
  Heart,
  MessageSquare,
  Bell,
  FileText,
  CreditCard,
  User,
  ShieldCheck,
  LifeBuoy,
  Car,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

const NAV = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/dashboard/trips", label: "Trips", icon: CalendarDays },
  { to: "/dashboard/favorites", label: "Favorites", icon: Heart },
  { to: "/dashboard/messages", label: "Messages", icon: MessageSquare },
  { to: "/dashboard/notifications", label: "Notifications", icon: Bell },
  { to: "/dashboard/documents", label: "Documents", icon: FileText },
  { to: "/dashboard/payments", label: "Payments", icon: CreditCard },
  { to: "/dashboard/profile", label: "Profile", icon: User },
  { to: "/dashboard/security", label: "Security", icon: ShieldCheck },
  { to: "/dashboard/support", label: "Support", icon: LifeBuoy },
];

export function useUnreadNotifications() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      const { count: c } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("read_at", null);
      if (!cancelled) setCount(c ?? 0);
    };
    load();
    const channel = supabase
      .channel("dash-notifications")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user]);

  return count;
}

export function DashboardLayout() {
  const unread = useUnreadNotifications();
  const { pathname } = useLocation();
  const { hasRole } = useAuth();

  return (
    <div className="container py-6 pb-28 md:pb-10">
      <div className="flex gap-8">
        <aside className="hidden md:block w-60 shrink-0" aria-label="Account navigation">
          <nav className="sticky top-20 space-y-1">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )
                }
              >
                <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="flex-1">{item.label}</span>
                {item.to === "/dashboard/notifications" && unread > 0 && (
                  <Badge variant="secondary" className="h-5 min-w-5 justify-center px-1 text-[11px]">
                    {unread > 99 ? "99+" : unread}
                  </Badge>
                )}
              </NavLink>
            ))}
            {!hasRole("host") && (
              <NavLink
                to="/become-host"
                className="mt-3 flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
              >
                <Car className="h-4 w-4" aria-hidden="true" />
                Become a host
              </NavLink>
            )}
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="md:hidden -mx-4 mb-4 overflow-x-auto px-4">
            <div className="flex gap-2 w-max">
              {NAV.map((item) => {
                const active = item.end ? pathname === item.to : pathname.startsWith(item.to);
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={cn(
                      "whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium",
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground",
                    )}
                  >
                    {item.label}
                  </NavLink>
                );
              })}
            </div>
          </div>
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export default DashboardLayout;
