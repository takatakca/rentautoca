 import { Navigate, useLocation } from "react-router-dom";
 import { useAuth, AppRole } from "@/contexts/AuthContext";
 import { Loader2 } from "lucide-react";
import { isRentautoMember } from "@/lib/rentauto-membership";
 
 interface ProtectedRouteProps {
   children: React.ReactNode;
   requiredRole?: AppRole;
 }
 
 export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
   const { user, roles, isLoading, hasRole } = useAuth();
   const location = useLocation();
 
   if (isLoading) {
     return (
       <div className="flex min-h-screen items-center justify-center">
         <Loader2 className="h-8 w-8 animate-spin text-primary" />
       </div>
     );
   }
 
  if (!user) {
    const dest = location.pathname + location.search;
    const q = dest && dest !== "/" ? `?redirect=${encodeURIComponent(dest)}` : "";
    return <Navigate to={`/login${q}`} state={{ from: location }} replace />;
  }

  // Shared TAKATAK Auth alone grants no Rentauto product access.
  // Guests, hosts and admins must hold a Rentauto account role.
  if (!isRentautoMember(roles)) {
    const dest = location.pathname + location.search;
    return (
      <Navigate
        to={`/signup?authorize=1&redirect=${encodeURIComponent(dest)}`}
        replace
      />
    );
  }
 
   if (
     requiredRole &&
     !hasRole(requiredRole) &&
     !(requiredRole === "host" && hasRole("admin"))
   ) {
     return <Navigate to="/" replace />;
   }
 
   return <>{children}</>;
 }