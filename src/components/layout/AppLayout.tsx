import { Outlet } from "react-router-dom";
import { AppHeader } from "./AppHeader";
import { MobileBottomNav } from "./MobileBottomNav";

export function AppLayout() {
  return (
    <div className="min-h-dvh flex flex-col">
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
