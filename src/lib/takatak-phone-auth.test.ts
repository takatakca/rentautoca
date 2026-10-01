import { describe, expect, it } from "vitest";
import { normalizeTakatakPhone, splitTakatakName } from "./takatak-phone-auth";

describe("normalizeTakatakPhone", () => {
  it("normalizes a Canadian 10 digit number", () => {
    expect(normalizeTakatakPhone("(514) 555-0123")).toBe("+15145550123");
  });

  it("preserves an E.164 number", () => {
    expect(normalizeTakatakPhone("+1 438 555 0199")).toBe("+14385550199");
  });

  it("supports international 00 prefixes", () => {
    expect(normalizeTakatakPhone("00 33 6 12 34 56 78")).toBe("+33612345678");
  });

  it("rejects ambiguous short numbers", () => {
    expect(normalizeTakatakPhone("555-1234")).toBeNull();
  });
});

describe("splitTakatakName", () => {
  it("keeps all surname parts", () => {
    expect(splitTakatakName("Marie de la Cruz")).toEqual({
      firstName: "Marie",
      lastName: "de la Cruz",
    });
  });
});
