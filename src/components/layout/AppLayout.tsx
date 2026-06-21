import { Outlet } from "react-router-dom";
import { AppHeader } from "./AppHeader";
import { MobileBottomNav } from "./MobileBottomNav";
import { PublicFooter } from "./PublicFooter";

export function AppLayout() {
  return (
    <div className="min-h-dvh flex flex-col">
      <AppHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <PublicFooter />
      <MobileBottomNav />
    </div>
  );
}
