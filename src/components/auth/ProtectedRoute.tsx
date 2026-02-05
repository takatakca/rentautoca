 import { Navigate, useLocation } from "react-router-dom";
 import { useAuth, AppRole } from "@/contexts/AuthContext";
 import { Loader2 } from "lucide-react";
 
 interface ProtectedRouteProps {
   children: React.ReactNode;
   requiredRole?: AppRole;
 }
 
 export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
   const { user, isLoading, hasRole } = useAuth();
   const location = useLocation();
 
   if (isLoading) {
     return (
       <div className="flex min-h-screen items-center justify-center">
         <Loader2 className="h-8 w-8 animate-spin text-primary" />
       </div>
     );
   }
 
   if (!user) {
     return <Navigate to="/login" state={{ from: location }} replace />;
   }
 
   if (requiredRole && !hasRole(requiredRole)) {
     return <Navigate to="/" replace />;
   }
 
   return <>{children}</>;
 }