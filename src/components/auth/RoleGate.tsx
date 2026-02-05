 import { useAuth, AppRole } from "@/contexts/AuthContext";
 
 interface RoleGateProps {
   children: React.ReactNode;
   allowedRoles: AppRole[];
   fallback?: React.ReactNode;
 }
 
 export function RoleGate({ children, allowedRoles, fallback = null }: RoleGateProps) {
   const { roles } = useAuth();
   
   const hasPermission = allowedRoles.some((role) => roles.includes(role));
   
   if (!hasPermission) {
     return <>{fallback}</>;
   }
 
   return <>{children}</>;
 }