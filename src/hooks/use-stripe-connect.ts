import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type OnboardingStatus = "not_started" | "pending" | "complete" | "error";

interface StripeStatus {
  stripe_account_id: string | null;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  onboarding_status: OnboardingStatus;
}

interface UseStripeConnectReturn {
  status: StripeStatus | null;
  isLoading: boolean;
  isOnboarding: boolean;
  error: string | null;
  startOnboarding: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  openDashboard: () => Promise<void>;
}

export function useStripeConnect(): UseStripeConnectReturn {
  const { session } = useAuth();
  const [status, setStatus] = useState<StripeStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!session?.access_token) return;
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("stripe-status", {
        method: "GET",
      });

      if (fnError) throw new Error(fnError.message);
      setStatus(data as StripeStatus);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch status";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const startOnboarding = async () => {
    if (!session?.access_token) return;
    setIsOnboarding(true);
    setError(null);

    try {
      const returnUrl = `${window.location.origin}/host`;
      const refreshUrl = `${window.location.origin}/host`;

      const { data, error: fnError } = await supabase.functions.invoke("stripe-onboard", {
        body: { return_url: returnUrl, refresh_url: refreshUrl },
      });

      if (fnError) throw new Error(fnError.message);
      if (data?.onboarding_url) {
        window.location.href = data.onboarding_url;
      } else {
        throw new Error("No onboarding URL returned");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to start onboarding";
      setError(message);
      setIsOnboarding(false);
    }
  };

  const openDashboard = async () => {
    if (!session?.access_token) return;
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("stripe-dashboard", {
        method: "GET",
      });

      if (fnError) throw new Error(fnError.message);
      if (data?.login_url) {
        window.open(data.login_url, "_blank");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to open dashboard";
      setError(message);
    }
  };

  return {
    status,
    isLoading,
    isOnboarding,
    error,
    startOnboarding,
    refreshStatus: fetchStatus,
    openDashboard,
  };
}
