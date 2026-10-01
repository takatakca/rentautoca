import { supabase } from "@/integrations/supabase/client";

export type TakatakSignupMetadata = {
  full_name: string;
  display_name: string;
  first_name: string;
  last_name: string | null;
  email: string;
  phone: string;
  source_application: "RENTAUTO";
  host_intent: "true" | "false";
  rentauto_terms_accepted_at: string;
  rentauto_privacy_accepted_at: string;
  rentauto_consent_captured_at: string;
};

export function normalizeTakatakPhone(raw: string): string | null {
  const input = raw.trim();
  if (!input) return null;

  if (input.startsWith("+")) {
    const digits = input.slice(1).replace(/\D/g, "");
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }

  if (input.startsWith("00")) {
    const digits = input.slice(2).replace(/\D/g, "");
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }

  const digits = input.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;

  return null;
}

export function splitTakatakName(fullName: string) {
  const [firstName, ...rest] = fullName.trim().split(/\s+/);
  return {
    firstName,
    lastName: rest.join(" ") || null,
  };
}

export async function requestTakatakSmsOtp(params: {
  phone: string;
  shouldCreateUser: boolean;
  metadata?: TakatakSignupMetadata;
}) {
  return supabase.auth.signInWithOtp({
    phone: params.phone,
    options: {
      shouldCreateUser: params.shouldCreateUser,
      ...(params.metadata ? { data: params.metadata } : {}),
    },
  });
}

export async function verifyTakatakSmsOtp(phone: string, token: string) {
  return supabase.auth.verifyOtp({
    phone,
    token,
    type: "sms",
  });
}

export async function bootstrapRentautoFromTakatak() {
  return supabase.functions.invoke("rentauto-bootstrap-account", {
    body: {},
  });
}
