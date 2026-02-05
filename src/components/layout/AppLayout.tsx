 import { Outlet } from "react-router-dom";
 import { AppHeader } from "./AppHeader";
 
 export function AppLayout() {
   return (
     <div className="min-h-screen flex flex-col">
       <AppHeader />
       <main className="flex-1">
         <Outlet />
       </main>
       <footer className="border-t py-6 text-center text-sm text-muted-foreground">
         <p>© {new Date().getFullYear()} Rentauto.ca — Canada's peer-to-peer car rental marketplace</p>
       </footer>
     </div>
   );
 }