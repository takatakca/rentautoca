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
  const authorizationGate = read(
    "supabase/migrations/20261003073000_rentauto_explicit_vertical_authorization.sql",
  );
  const authorizeAccount = read(
    "supabase/functions/rentauto-authorize-account/index.ts",
  );
  const bootstrapAccount = read(
    "supabase/functions/rentauto-bootstrap-account/index.ts",
  );

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

  it("requires explicit server-side Rentauto authorization for every new vertical account", () => {
    expect(authorizationGate).toContain("rentauto_consent_required");
    expect(authorizationGate).toContain("raw_app_meta_data");
    expect(authorizationGate).toContain("rentauto_authorized_at");
    expect(authorizationGate).toContain("rentauto_terms_accepted_at");
    expect(authorizationGate).toContain("rentauto_privacy_accepted_at");
    expect(authorizeAccount).toContain("admin.auth.admin.updateUserById");
    expect(authorizeAccount).toContain("app_metadata");
    expect(authorizeAccount).toContain("rentauto_terms_version");
    expect(authorizeAccount).toContain("rentauto_privacy_version");
    expect(bootstrapAccount).toContain("RENTAUTO_CONSENT_REQUIRED");
  });

  it("routes SMS, Google and existing TAKATAK users through the same Rentauto authorization", () => {
    expect(signup).toContain("authorizeRentautoAccount");
    expect(signup).toContain('searchParams.get("authorize") === "1"');
    expect(signup).toContain("You must accept the Terms and Privacy Policy");
    expect(authContext).toContain("authorizeRentautoAccount");
    expect(authContext).toContain("/signup?authorize=1");
    expect(login).toContain('result.status === "consent_required"');
    expect(login).toContain("/signup?authorize=1");
  });

  it("does not let generic auth events silently opt a TAKATAK identity into Rentauto", () => {
    expect(authContext).not.toContain('event === "SIGNED_IN"');
    expect(authContext).not.toContain("bootstrapOnSignIn");
  });

  it("treats verified email or verified mobile as TAKATAK identity authority", () => {
    expect(overview).toContain("user?.email_confirmed_at || profile?.phone_verified");
    expect(hostApplication).toContain("Verify a TAKATAK email or mobile number");
    expect(hostApplication).toContain("IDENTITY_VERIFICATION_REQUIRED");
    expect(hostApplication).not.toContain("EMAIL_VERIFICATION_REQUIRED");
  });
});
