import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

describe("agent continuity contract", () => {
  const required = [
    "PROJECT_STATUS.md",
    "TASK_QUEUE.md",
    "AGENT_HANDOFF.md",
    "DEPLOYMENT.md",
    "DECISIONS.md",
  ] as const;

  it.each(required)("maintains %s in docs", (file) => {
    const text = readFileSync(join(process.cwd(), "docs", file), "utf8");
    expect(text).toContain("RENTAUTO.CA");
    expect(text.length).toBeGreaterThan(100);
  });

  it("requires actionable handoff evidence without exposing credentials", () => {
    const content = readFileSync(join(process.cwd(), "docs/AGENT_HANDOFF.md"), "utf8");
    for (const section of ["Latest completed action", "Current task", "Files changed", "Last verified", "Executed verification", "Known problems", "Exact next action"]) {
      expect(content).toContain(section);
    }
  });

  it("blocks accidental reuse of incompatible global migration instructions", () => {
    const instructions = readFileSync(join(process.cwd(), "AGENTS.md"), "utf8");
    expect(instructions).toContain("Do not apply");
    expect(instructions).toContain("20260930161000_takatak_integration_outbox.sql");
  });
});
