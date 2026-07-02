import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { ensureProfile } from "@/lib/auth-helpers";

export type AppRole = "guest" | "host" | "admin";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  roles: AppRole[];
  displayName: string | null;
  isLoading: boolean;
  hasRole: (role: AppRole) => boolean;
  signOut: () => Promise<void>;
  refreshRoles: () => Promise<void>;
}
 
 const AuthContext = createContext<AuthContextType | undefined>(undefined);
 
 export function AuthProvider({ children }: { children: ReactNode }) {
   const [session, setSession] = useState<Session | null>(null);
   const [user, setUser] = useState<User | null>(null);
   const [roles, setRoles] = useState<AppRole[]>([]);
   const [isLoading, setIsLoading] = useState(true);
 
   const fetchRoles = async (userId: string) => {
     const { data, error } = await supabase
       .from("user_roles")
       .select("role")
       .eq("user_id", userId);
     
     if (error) {
       console.error("Error fetching roles:", error);
       return [];
     }
     
     return (data || []).map((r) => r.role as AppRole);
   };
 
   const refreshRoles = async () => {
     if (user) {
       const userRoles = await fetchRoles(user.id);
       setRoles(userRoles);
     }
   };
 
   useEffect(() => {
     // Set up auth state listener BEFORE checking session
     const { data: { subscription } } = supabase.auth.onAuthStateChange(
       async (event, session) => {
         setSession(session);
         setUser(session?.user ?? null);
         
         if (session?.user) {
           // Use setTimeout to avoid potential deadlock with Supabase client
           setTimeout(async () => {
             const userRoles = await fetchRoles(session.user.id);
             setRoles(userRoles);
             setIsLoading(false);
           }, 0);
         } else {
           setRoles([]);
           setIsLoading(false);
         }
       }
     );
 
     // Check initial session
     supabase.auth.getSession().then(({ data: { session } }) => {
       setSession(session);
       setUser(session?.user ?? null);
       if (session?.user) {
         fetchRoles(session.user.id).then((userRoles) => {
           setRoles(userRoles);
           setIsLoading(false);
         });
       } else {
         setIsLoading(false);
       }
     });
 
     return () => {
       subscription.unsubscribe();
     };
   }, []);
 
   const hasRole = (role: AppRole) => roles.includes(role);
 
   const signOut = async () => {
     await supabase.auth.signOut();
     setSession(null);
     setUser(null);
     setRoles([]);
   };
 
   return (
     <AuthContext.Provider
       value={{
         session,
         user,
         roles,
         isLoading,
         hasRole,
         signOut,
         refreshRoles,
       }}
     >
       {children}
     </AuthContext.Provider>
   );
 }
 
 export function useAuth() {
   const context = useContext(AuthContext);
   if (context === undefined) {
     throw new Error("useAuth must be used within an AuthProvider");
   }
   return context;
 }