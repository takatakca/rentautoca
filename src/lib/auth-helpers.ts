import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

/**
 * Only accept same-origin internal paths starting with a single "/".
 * Rejects protocol-relative ("//evil.com"), absolute URLs, and empty strings.
 */
export function sanitizeRedirect(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("//")) return null;
  if (/^\/https?:/i.test(raw)) return null;
  return raw;
}

export const RENTAUTO_OAUTH_INTENT_KEY = "rentauto_oauth_intent_v1";

export type RentautoOAuthIntent =
  | {
      kind: "login";
      redirect: string | null;
    }
  | {
      kind: "signup";
      redirect: string | null;
      hostIntent: boolean;
    };

export function storeRentautoOAuthIntent(intent: RentautoOAuthIntent): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(
    RENTAUTO_OAUTH_INTENT_KEY,
    JSON.stringify({
      ...intent,
      redirect: sanitizeRedirect(intent.redirect),
    }),
  );
}

export function readRentautoOAuthIntent(): RentautoOAuthIntent | null {
  if (typeof window === "undefined") return null;

  const raw = sessionStorage.getItem(RENTAUTO_OAUTH_INTENT_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<RentautoOAuthIntent> & {
      kind?: unknown;
      redirect?: unknown;
      hostIntent?: unknown;
    };

    if (parsed.kind === "login") {
      return {
        kind: "login",
        redirect:
          typeof parsed.redirect === "string"
            ? sanitizeRedirect(parsed.redirect)
            : null,
      };
    }

    if (parsed.kind === "signup") {
      return {
        kind: "signup",
        redirect:
          typeof parsed.redirect === "string"
            ? sanitizeRedirect(parsed.redirect)
            : null,
        hostIntent: parsed.hostIntent === true,
      };
    }
  } catch {
    // Invalid browser state is discarded below.
  }

  sessionStorage.removeItem(RENTAUTO_OAUTH_INTENT_KEY);
  return null;
}

export function clearRentautoOAuthIntent(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(RENTAUTO_OAUTH_INTENT_KEY);
}

export function friendlyAuthError(message: string | undefined | null): string {
  if (!message) return "Something went wrong. Please try again.";
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "That email and password don't match. Please try again.";
  if (m.includes("email not confirmed")) return "Please confirm your email before logging in. Check your inbox for the code.";
  if (m.includes("user already registered")) return "An account with this email already exists. Try logging in instead.";
  if (m.includes("password should be")) return "Password must be at least 8 characters.";
  if (
    m.includes("sms") &&
    (m.includes("provider") || m.includes("disabled") || m.includes("not enabled"))
  ) return "TAKATAK SMS verification is temporarily unavailable. Please try another sign-in method.";
  if (m.includes("phone") && m.includes("invalid")) return "Enter a valid mobile number including the area code.";
  if (m.includes("rate limit") || m.includes("too many")) return "Too many attempts. Please wait a minute and try again.";
  if (m.includes("otp") && m.includes("expired")) return "That code expired. Request a new one.";
  if (m.includes("token") && (m.includes("invalid") || m.includes("expired"))) return "That code is invalid or has expired. Request a new one.";
  if (m.includes("pwned") || m.includes("compromised")) return "This password has appeared in a public data breach. Please choose a different one.";
  return message;
}

export function passwordStrength(pw: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw) && pw.length >= 12) s++;
  const label = ["Too short", "Weak", "Fair", "Good", "Strong"][s] || "Weak";
  return { score: s as 0 | 1 | 2 | 3 | 4, label };
}

/**
 * Ensure the authenticated TAKATAK identity is already authorized for RENTAUTO,
 * then synchronize its Rentauto projection and display profile.
 *
 * A TAKATAK login is not equivalent to RENTAUTO consent. New vertical access
 * must be granted through rentauto-authorize-account first.
 */
export type EnsureProfileResult =
  | { status: "ready" }
  | { status: "consent_required" }
  | { status: "error"; message: string };

export async function ensureProfile(user: User): Promise<EnsureProfileResult> {
  try {
    const { data: existingAccount, error: accountError } = await supabase
      .from("accounts")
      .select("auth_user_id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (accountError) {
      console.warn("Rentauto account lookup failed", accountError.message);
      return { status: "error", message: accountError.message };
    }

    const appMetadata = (user.app_metadata || {}) as Record<string, unknown>;
    const hasServerAuthorization =
      typeof appMetadata.rentauto_authorized_at === "string" &&
      typeof appMetadata.rentauto_terms_accepted_at === "string" &&
      typeof appMetadata.rentauto_privacy_accepted_at === "string";

    if (!existingAccount && !hasServerAuthorization) {
      return { status: "consent_required" };
    }

    const { error: bootstrapError } = await supabase.functions.invoke(
      "rentauto-bootstrap-account",
      { body: {} },
    );

    if (bootstrapError) {
      console.warn("Rentauto account bootstrap failed", bootstrapError.message);
      return { status: "error", message: bootstrapError.message };
    }

    const md = (user.user_metadata || {}) as Record<string, unknown>;
    const fullName =
      typeof md.full_name === "string"
        ? md.full_name
        : typeof md.name === "string"
          ? md.name
          : typeof md.display_name === "string"
            ? md.display_name
            : undefined;
    const firstName =
      typeof md.first_name === "string"
        ? md.first_name
        : fullName
          ? fullName.split(" ")[0]
          : undefined;
    const lastName =
      typeof md.last_name === "string"
        ? md.last_name
        : fullName
          ? fullName.split(" ").slice(1).join(" ") || undefined
          : undefined;
    const avatarUrl =
      typeof md.avatar_url === "string"
        ? md.avatar_url
        : typeof md.picture === "string"
          ? md.picture
          : undefined;

    const { data: existing } = await supabase
      .from("profiles")
      .select("id, display_name, first_name, last_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle();

    if (existing) {
      const patch: {
        display_name?: string;
        first_name?: string;
        last_name?: string;
        avatar_url?: string;
      } = {};

      if (fullName && !existing.display_name) patch.display_name = fullName;
      if (firstName && !existing.first_name) patch.first_name = firstName;
      if (lastName && !existing.last_name) patch.last_name = lastName;
      if (avatarUrl && !existing.avatar_url) patch.avatar_url = avatarUrl;

      if (Object.keys(patch).length > 0) {
        const { error } = await supabase
          .from("profiles")
          .update(patch)
          .eq("id", user.id);

        if (error) {
          console.warn("Rentauto profile metadata sync failed", error.message);
        }
      }
    }

    return { status: "ready" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("ensureProfile failed", message);
    return { status: "error", message };
  }
}
