import { Outlet } from "react-router-dom";
import { AppHeader } from "./AppHeader";
import { MobileBottomNav } from "./MobileBottomNav";
import { RouteMeta } from "@/components/seo/RouteMeta";

export function AppLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <RouteMeta />
      <AppHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-border/50 py-8 text-center text-sm text-muted-foreground hidden md:block">
        <p>© {new Date().getFullYear()} Rentauto.ca — Canada's peer-to-peer car rental marketplace</p>
      </footer>
      <MobileBottomNav />
    </div>
  );
}
