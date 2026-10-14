import { describe, expect, it } from "vitest";
import { isRentautoMember, normalizeRentautoRoles } from "./rentauto-membership";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Rentauto role isolation against the live Supabase schema", () => {
  it("recognizes only the Rentauto guest, host and admin roles", () => {
    expect(normalizeRentautoRoles([{role:"guest"},{role:"admin"},{role:"guest"},{role:"platform_admin"}])).toEqual(["guest","admin"]);
    expect(isRentautoMember([])).toBe(false);
    expect(isRentautoMember(["platform_admin"])).toBe(false);
    expect(isRentautoMember(["host"])).toBe(true);
  });

  it("reads the actual RENTAUTO account_roles table and auth_user_id column", () => {
    for (const path of ["src/contexts/AuthContext.tsx","src/lib/auth-helpers.ts"]) {
      const source = read(path);
      expect(source).toContain('.from("account_roles")');
      expect(source).toContain('.eq("auth_user_id",');
      expect(source).not.toContain('.from("user_roles")');
    }
  });

  it("requires per-product membership before any protected customer route", () => {
    const route = read("src/components/auth/ProtectedRoute.tsx");
    expect(route).toContain("isRentautoMember(roles)");
    expect(route).toContain("/signup?authorize=1&redirect=");
    expect(route.indexOf("isRentautoMember(roles)")).toBeLessThan(route.indexOf("requiredRole &&"));
  });

  it("refreshes Rentauto account roles after an existing TAKATAK user grants consent", () => {
    const signup = read("src/pages/Signup.tsx");
    expect(signup).toContain("await refreshRoles();");
    expect(signup).toContain("authorizeRentautoAccount(hostIntent)");
  });
});
