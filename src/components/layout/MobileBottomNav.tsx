import { Link, useLocation } from "react-router-dom";
import { Search, Heart, MessageSquare, MoreHorizontal } from "lucide-react";

const navItems = [
  { icon: Search, label: "Search", path: "/" },
  { icon: Heart, label: "Favorites", path: "/favorites" },
  {
    icon: () => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6">
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
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border md:hidden">
      <div className="flex items-center justify-around py-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              to={item.path}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 text-xs transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}
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
