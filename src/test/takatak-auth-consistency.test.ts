import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("TAKATAK authentication authority contracts", () => {
  const phoneAuthority = read(
    "supabase/migrations/20261003071500_rentauto_verified_phone_change_authority.sql",
  );
  const security = read("src/pages/dashboard/Security.tsx");
  const profile = read("src/pages/Profile.tsx");
  const signup = read("src/pages/Signup.tsx");
  const login = read("src/pages/Login.tsx");
  const authContext = read("src/contexts/AuthContext.tsx");
  const hostApplication = read(
    "supabase/functions/rentauto-host-application/index.ts",
  );
  const overview = read("src/pages/dashboard/Overview.tsx");

  it("never carries verified-phone state through an ordinary profile edit", () => {
    expect(phoneAuthority).toContain("verified_phone_change_required");
    expect(phoneAuthority).toContain("NEW.phone IS DISTINCT FROM OLD.phone");
    expect(phoneAuthority).not.toContain("phone = NEW.phone");
    expect(profile).not.toContain("phone: profile.phone || null");
    expect(profile).toContain("/dashboard/security");
  });

  it("changes the TAKATAK mobile only through Supabase Auth phone-change OTP", () => {
    expect(security).toContain("supabase.auth.updateUser({ phone })");
    expect(security).toContain('type: "phone_change"');
    expect(security).toContain("bootstrapRentautoFromTakatak");
    expect(security).toContain("supabase.auth.refreshSession()");
  });

  it("preserves only safe internal destinations across Google OAuth", () => {
    expect(login).toContain("storeRentautoOAuthIntent");
    expect(authContext).toContain("sanitizeRedirect(pending.redirect)");
    expect(authContext).toContain("window.location.replace(oauthResult.redirect)");
  });

  it("requires and persists Rentauto consent for Google signup", () => {
    expect(signup).toContain("if (!acceptTerms)");
    expect(signup).toContain('kind: "signup"');
    expect(authContext).toContain("rentauto_terms_accepted_at");
    expect(authContext).toContain("rentauto_privacy_accepted_at");
    expect(authContext).toContain("rentauto_consent_captured_at");
    expect(authContext).toContain("await ensureProfile(resolvedUser)");
  });

  it("treats verified email or verified mobile as TAKATAK identity authority", () => {
    expect(overview).toContain("user?.email_confirmed_at || profile?.phone_verified");
    expect(hostApplication).toContain("Verify a TAKATAK email or mobile number");
    expect(hostApplication).toContain("IDENTITY_VERIFICATION_REQUIRED");
    expect(hostApplication).not.toContain("EMAIL_VERIFICATION_REQUIRED");
  });
});
