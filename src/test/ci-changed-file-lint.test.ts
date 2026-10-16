import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const workflow = readFileSync(join(process.cwd(), ".github/workflows/ci.yml"), "utf8");
const lint = workflow.split("      - name: Lint changed TypeScript files")[1]?.split("      - name: Protect shared TAKATAK schema")[0] ?? "";
describe("CI changed-file lint", () => {
  it("compares push to prior SHA, not origin/main...HEAD", () => {
    expect(lint).toContain("github.event.before");
    expect(lint).toContain('BASE_SHA="$PUSH_BASE"');
    expect(lint).toContain('git diff --name-only --diff-filter=ACMR "$BASE_SHA" HEAD');
    expect(lint).not.toContain("origin/main...HEAD");
  });
  it("also handles PR bases and missing push history", () => {
    expect(lint).toContain("github.event.pull_request.base.sha");
    expect(lint).toContain('BASE_SHA="$PR_BASE"');
    expect(lint).toContain("git cat-file -e");
    expect(lint).toContain("git rev-parse HEAD^");
  });
});
