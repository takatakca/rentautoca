import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import {
  clearRentautoOAuthIntent,
  ensureProfile,
  readRentautoOAuthIntent,
  sanitizeRedirect,
} from "@/lib/auth-helpers";
import { authorizeRentautoAccount } from "@/lib/takatak-phone-auth";

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
   const oauthFinalizeRef = useRef<
     Promise<{ resolvedUser: User; redirect: string | null } | null> | null
   >(null);
 
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
 
  const [displayName, setDisplayName] = useState<string | null>(null);

  const hydrateDisplayName = async (u: User) => {
    const md = (u.user_metadata || {}) as Record<string, unknown>;
    const fromMeta =
      typeof md.full_name === "string"
        ? md.full_name
        : typeof md.display_name === "string"
          ? md.display_name
          : typeof md.name === "string"
            ? md.name
            : null;
    if (fromMeta) {
      setDisplayName(fromMeta);
    }
    const { data } = await supabase
      .from("profiles")
      .select("display_name, first_name")
      .eq("id", u.id)
      .maybeSingle();
    if (data?.display_name || data?.first_name) {
      setDisplayName(data.display_name || data.first_name);
    }
  };

  const finishPendingOAuth = async (
    authenticatedUser: User,
  ): Promise<{ resolvedUser: User; redirect: string | null } | null> => {
    const pending = readRentautoOAuthIntent();
    if (!pending) {
      return { resolvedUser: authenticatedUser, redirect: null };
    }

    if (!oauthFinalizeRef.current) {
      oauthFinalizeRef.current = (async () => {
        let resolvedUser = authenticatedUser;
        const safeDestination = sanitizeRedirect(pending.redirect) || "/";

        if (pending.kind === "signup") {
          const { error: authorizationError } = await authorizeRentautoAccount(
            pending.hostIntent,
          );

          if (authorizationError) {
            console.error(
              "Could not authorize Rentauto after Google sign-in",
              authorizationError.message,
            );
            clearRentautoOAuthIntent();

            if (typeof window !== "undefined") {
              window.location.replace(
                `/signup?authorize=1&oauth_error=authorization&redirect=${encodeURIComponent(safeDestination)}`,
              );
            }
            return null;
          }

          const { data } = await supabase.auth.refreshSession();
          if (data.user) resolvedUser = data.user;
        } else {
          const bootstrapResult = await ensureProfile(resolvedUser);

          if (bootstrapResult.status === "consent_required") {
            clearRentautoOAuthIntent();
            if (typeof window !== "undefined") {
              window.location.replace(
                `/signup?authorize=1&redirect=${encodeURIComponent(safeDestination)}`,
              );
            }
            return null;
          }

          if (bootstrapResult.status === "error") {
            console.error(
              "Could not synchronize Rentauto after Google sign-in",
              bootstrapResult.message,
            );
            clearRentautoOAuthIntent();
            if (typeof window !== "undefined") {
              window.location.replace("/login?oauth_error=sync");
            }
            return null;
          }
        }

        clearRentautoOAuthIntent();

        return {
          resolvedUser,
          redirect: safeDestination,
        };
      })().finally(() => {
        oauthFinalizeRef.current = null;
      });
    }

    return oauthFinalizeRef.current;
  };

  const hydrateAuthenticatedUser = async (
    authenticatedUser: User,
  ) => {
    const oauthResult = await finishPendingOAuth(authenticatedUser);

    if (!oauthResult) return;

    const resolvedUser = oauthResult.resolvedUser;

    setUser(resolvedUser);
    await hydrateDisplayName(resolvedUser);
    const userRoles = await fetchRoles(resolvedUser.id);
    setRoles(userRoles);
    setIsLoading(false);

    if (oauthResult.redirect && typeof window !== "undefined") {
      const current = window.location.pathname + window.location.search;
      if (current !== oauthResult.redirect) {
        window.location.replace(oauthResult.redirect);
      }
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);

        if (nextSession?.user) {
          setTimeout(() => {
            void hydrateAuthenticatedUser(nextSession.user);
          }, 0);
        } else {
          setUser(null);
          setRoles([]);
          setDisplayName(null);
          setIsLoading(false);
        }
      },
    );

    void supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);

      if (currentSession?.user) {
        void hydrateAuthenticatedUser(currentSession.user);
      } else {
        setUser(null);
        setIsLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
    // Auth helpers are intentionally stable for the lifetime of the provider.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasRole = (role: AppRole) => roles.includes(role);

  const signOut = async () => {
    clearRentautoOAuthIntent();
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setRoles([]);
    setDisplayName(null);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        roles,
        displayName,
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