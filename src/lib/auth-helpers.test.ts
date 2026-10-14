import { describe, expect, it } from "vitest";
import { sanitizeRedirect } from "./auth-helpers";

describe("safe OAuth return destinations", () => {
  it.each([
    ["/", "/"],
    ["/dashboard/trips", "/dashboard/trips"],
    ["/trips/123?tab=evidence#photos", "/trips/123?tab=evidence#photos"],
    ["/signup?authorize=1", "/signup?authorize=1"],
  ])("keeps internal destination %s", (input, expected) => {
    expect(sanitizeRedirect(input)).toBe(expected);
  });

  it.each([
    null, undefined, "", "https://evil.example", "http://evil.example",
    "//evil.example/steal", "///evil.example", "/\\evil.example",
    "/%5cevil.example", "/dashboard\n//evil.example", "/https://evil.example",
    " javascript:alert(1)", "javascript:alert(1)", "dashboard",
  ])("rejects unsafe redirect %s", (input) => {
    expect(sanitizeRedirect(input)).toBeNull();
  });
});
