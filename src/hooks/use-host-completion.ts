import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface CompletionSection {
  id: string;
  label: string;
  description: string;
  weight: number;
  required: boolean;
  complete: boolean;
  status: "complete" | "incomplete" | "not_started";
}

export interface HostCompletionData {
  profile: Record<string, any> | null;
  verification: Record<string, any> | null;
  preferences: Record<string, any> | null;
  stripeAccount: Record<string, any> | null;
}

export interface HostCompletion {
  sections: CompletionSection[];
  percentage: number;
  canPublish: boolean;
  canAcceptBookings: boolean;
  data: HostCompletionData;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

export function useHostCompletion(): HostCompletion {
  const { user } = useAuth();
  const [data, setData] = useState<HostCompletionData>({
    profile: null,
    verification: null,
    preferences: null,
    stripeAccount: null,
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);

    const [profileRes, verificationRes, preferencesRes, stripeRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("host_verifications").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("host_preferences").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("stripe_accounts").select("*").eq("user_id", user.id).maybeSingle(),
    ]);

    setData({
      profile: profileRes.data,
      verification: verificationRes.data,
      preferences: preferencesRes.data,
      stripeAccount: stripeRes.data,
    });
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const p = data.profile;
  const v = data.verification;
  const pref = data.preferences;
  const s = data.stripeAccount;

  const hasBasicInfo = !!(p?.display_name && p?.avatar_url && p?.bio && p?.phone);
  const hasLocation = !!(p?.city && p?.province && p?.postal_code);
  const isVerified = v?.verification_status === "approved";
  const hasStripe = !!(s?.charges_enabled && s?.payouts_enabled);
  const hasPrefs = !!pref;
  const hasEmergency = !!(pref?.emergency_contact_name && pref?.emergency_contact_phone);

  const sections: CompletionSection[] = [
    {
      id: "basic-info",
      label: "Basic Info",
      description: "Display name, photo, bio, and phone number",
      weight: 20,
      required: true,
      complete: hasBasicInfo,
      status: hasBasicInfo ? "complete" : (p?.display_name || p?.avatar_url || p?.bio || p?.phone) ? "incomplete" : "not_started",
    },
    {
      id: "location",
      label: "Location",
      description: "City, province, and postal code",
      weight: 15,
      required: true,
      complete: hasLocation,
      status: hasLocation ? "complete" : (p?.city || p?.province || p?.postal_code) ? "incomplete" : "not_started",
    },
    {
      id: "verification",
      label: "Identity Verification",
      description: "Government ID and selfie for trust & safety",
      weight: 25,
      required: true,
      complete: isVerified,
      status: isVerified ? "complete" : (v?.verification_status && v.verification_status !== "not_started") ? "incomplete" : "not_started",
    },
    {
      id: "payout",
      label: "Payout Setup",
      description: "Connect Stripe to receive earnings",
      weight: 20,
      required: true,
      complete: hasStripe,
      status: hasStripe ? "complete" : s?.stripe_account_id ? "incomplete" : "not_started",
    },
    {
      id: "preferences",
      label: "Host Preferences",
      description: "Trip length, advance notice, and delivery options",
      weight: 10,
      required: false,
      complete: hasPrefs,
      status: hasPrefs ? "complete" : "not_started",
    },
    {
      id: "emergency",
      label: "Emergency Contact",
      description: "Emergency contact information for safety",
      weight: 10,
      required: false,
      complete: hasEmergency,
      status: hasEmergency ? "complete" : "not_started",
    },
  ];

  const completedWeight = sections.filter((s) => s.complete).reduce((sum, s) => sum + s.weight, 0);
  const totalWeight = sections.reduce((sum, s) => sum + s.weight, 0);
  const percentage = Math.round((completedWeight / totalWeight) * 100);

  return {
    sections,
    percentage,
    canPublish: percentage >= 50,
    canAcceptBookings: percentage >= 80,
    data,
    isLoading,
    refresh: fetchAll,
  };
}
