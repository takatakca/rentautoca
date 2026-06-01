import { Link, useLocation } from "react-router-dom";
import { Search, Heart, MessageSquare, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: Search, label: "Search", path: "/explore" },
  { icon: Heart, label: "Favorites", path: "/favorites" },
  {
    icon: () => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6" aria-hidden="true">
        <path d="M12 4v16M6 8l6-4 6 4M5 20h14" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    label: "Trips",
    path: "/trips",
  },
  { icon: MessageSquare, label: "Inbox", path: "/messages" },
  { icon: MoreHorizontal, label: "More", path: "/profile" },
];

export function MobileBottomNav() {
  const location = useLocation();

  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur border-t border-border md:hidden pb-safe"
    >
      <div className="flex items-center justify-around py-1.5">
        {navItems.map((item) => {
          const isActive =
            location.pathname === item.path ||
            (item.path !== "/profile" && location.pathname.startsWith(item.path + "/"));
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              to={item.path}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1.5 text-[11px] font-medium min-w-11 min-h-11 rounded-lg transition-colors",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-6 w-6" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
