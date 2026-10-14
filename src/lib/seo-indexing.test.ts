import { describe, expect, it } from "vitest";
import { shouldNoIndex } from "./seo-indexing";

describe("route indexing policy", () => {
  it.each(["/", "/explore", "/cars/vehicle-123", "/for-hosts", "/how-it-works", "/privacy", "/concierge", "/travel-planner"])(
    "allows public known route %s",
    (route) => expect(shouldNoIndex(route, true)).toBe(false),
  );

  it.each(["/trips", "/trips/abc", "/checkout/abc", "/dashboard/payments", "/admin/support", "/host/cars", "/profile", "/login", "/signup", "/favorites", "/messages", "/concierge/thread-123", "/TRIPS/", "/become-host"])(
    "excludes private route %s",
    (route) => expect(shouldNoIndex(route, true)).toBe(true),
  );

  it("excludes all unknown or 404 routes", () => {
    expect(shouldNoIndex("/not-a-real-route", false)).toBe(true);
  });

  it("uses path segment boundaries instead of overly broad prefix matching", () => {
    expect(shouldNoIndex("/hosted-vehicles", true)).toBe(false);
    expect(shouldNoIndex("/tripstory", true)).toBe(false);
  });
});
