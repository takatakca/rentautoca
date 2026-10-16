import { describe, expect, it } from "vitest";
import {
  isTakatakSyncReceipt,
  validateTakatakSyncUrl,
} from "../../supabase/functions/_shared/takatak-sync-transport";

const route = "/api/integrations/rentauto/events";

describe("TAKATAK signed synchronization delivery boundary", () => {
  it("accepts only the real receiver path on the master TAKATAK domain", () => {
    expect(validateTakatakSyncUrl("https://takatak.ca" + route))
      .toBe("https://takatak.ca" + route);
    expect(validateTakatakSyncUrl("https://api.takatak.ca" + route))
      .toBe("https://api.takatak.ca" + route);
  });

  it("blocks HTTP, off-domain, credentials, fragments, queries, redirects and wrong API paths", () => {
    const bad = [
      "", "http://takatak.ca" + route,
      "https://takatak.ca.evil.example" + route,
      "https://evil.example" + route,
      "https://user:pass@takatak.ca" + route,
      "https://takatak.ca:8443" + route,
      "https://takatak.ca" + route + "?redirect=https://evil.example",
      "https://takatak.ca" + route + "#secret",
      "https://takatak.ca/api/unrelated",
      "https://localhost" + route,
      " https://takatak.ca" + route,
      "https://takatak.ca" + route + " ",
    ];
    for (const url of bad) expect(validateTakatakSyncUrl(url)).toBeNull();
  });

  it("permits an explicitly configured HTTPS staging receiver only by exact origin", () => {
    const testEndpoint = "https://preview-rentauto.example.org" + route;
    expect(validateTakatakSyncUrl(testEndpoint)).toBeNull();
    expect(validateTakatakSyncUrl(testEndpoint, "https://preview-rentauto.example.org"))
      .toBe(testEndpoint);
    expect(validateTakatakSyncUrl(testEndpoint, "https://evil.example.org")).toBeNull();
    expect(validateTakatakSyncUrl(testEndpoint, "http://preview-rentauto.example.org")).toBeNull();
    expect(validateTakatakSyncUrl(testEndpoint, "https://preview-rentauto.example.org/other")).toBeNull();
  });

  it("requires a valid receiver acknowledgment before treating an event as delivered", () => {
    expect(isTakatakSyncReceipt({ accepted: true, duplicate: true })).toBe(true);
    expect(isTakatakSyncReceipt({ accepted: true })).toBe(true);
    for (const body of [
      {}, { accepted: false }, { accepted: "true" }, [], null, "OK", { ok: true },
    ]) expect(isTakatakSyncReceipt(body)).toBe(false);
  });
});
