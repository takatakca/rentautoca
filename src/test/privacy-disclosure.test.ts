import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("accurate privacy disclosure", () => {
  const source = readFileSync(join(process.cwd(), "src/pages/legal/Privacy.tsx"), "utf8");

  it("reflects the verified TAKATAK EU West project region", () => {
    expect(source).toContain("EU West");
    expect(source).toContain("additional jurisdictions");
  });

  it("does not promise Canada/US-only processing or a blanket unverified retention period", () => {
    expect(source).not.toContain("stored on infrastructure located in Canada and the United States");
    expect(source).not.toContain("up to 7 years afterward");
  });
});
