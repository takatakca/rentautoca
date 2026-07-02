import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export function friendlyAuthError(message: string | undefined | null): string {
  if (!message) return "Something went wrong. Please try again.";
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "That email and password don't match. Please try again.";
  if (m.includes("email not confirmed")) return "Please confirm your email before logging in. Check your inbox for the code.";
  if (m.includes("user already registered")) return "An account with this email already exists. Try logging in instead.";
  if (m.includes("password should be")) return "Password must be at least 8 characters.";
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
 * Ensure a profile row exists for the current user and backfill display data
 * from auth user_metadata (Google sign-in populates full_name / name / avatar_url).
 * Never grants roles or elevates privileges.
 */
export async function ensureProfile(user: User): Promise<void> {
  try {
    const md = (user.user_metadata || {}) as Record<string, any>;
    const fullName: string | undefined = md.full_name || md.name || md.display_name;
    const firstName = md.first_name || (fullName ? fullName.split(" ")[0] : undefined);
    const lastName = md.last_name || (fullName ? fullName.split(" ").slice(1).join(" ") || null : undefined);
    const avatarUrl = md.avatar_url || md.picture || null;

    const { data: existing } = await supabase
      .from("profiles")
      .select("id, display_name, first_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle();

    const patch: Record<string, any> = {};
    if (fullName && !existing?.display_name) patch.display_name = fullName;
    if (firstName && !existing?.first_name) patch.first_name = firstName;
    if (lastName !== undefined && lastName && !existing) patch.last_name = lastName;
    if (avatarUrl && !existing?.avatar_url) patch.avatar_url = avatarUrl;

    if (!existing) {
      await supabase.from("profiles").upsert({ id: user.id, ...patch });
    } else if (Object.keys(patch).length > 0) {
      await supabase.from("profiles").update(patch).eq("id", user.id);
    }
  } catch (e) {
    console.warn("ensureProfile failed", e);
  }
}
