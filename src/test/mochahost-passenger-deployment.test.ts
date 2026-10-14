import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("MochaHost release-pointer deployment contracts", () => {
  const server = read("server.cjs");
  const workflow = read(".github/workflows/deploy-mochahost.yml");

  it("keeps explicit deployment probes outside the fallback server", () => {
    expect(server).toContain('app.get("/healthz"');
    expect(server).toContain('app.get("/revision.txt"');
    expect(server.indexOf('app.get("/healthz"')).toBeLessThan(
      server.indexOf("SPA fallback"),
    );
  });

  it("deploys immutable releases instead of swapping an app-root dist", () => {
    expect(workflow).toContain('RELEASE_DIR="releases/${SHA}"');
    expect(workflow).toContain('printf \'%s\\n\' "$SHA" > CURRENT.new');
    expect(workflow).toContain("mv CURRENT.new CURRENT");
    expect(workflow).toContain("PREVIOUS.new");
    expect(workflow).not.toContain("Atomically activate app-root dist");
    expect(workflow).not.toContain('mv "$STAGE/dist" dist');
  });

  it("restarts Passenger after CURRENT changes and rollback", () => {
    const restartTouches = workflow.split("touch tmp/restart.txt").length - 1;
    expect(restartTouches).toBeGreaterThanOrEqual(2);
  });

  it("verifies the live revision from the installed health JSON", () => {
    expect(workflow).toContain('"revision\\":\\"$SHA\\"');
    expect(workflow).toContain('"revision\\":\\"$DEPLOY_SHA\\"');
    expect(workflow).toContain('grep -Eq \'"ok"[[:space:]]*:[[:space:]]*true\'');
  });

  it("preserves immutable build evidence before touching production", () => {
    expect(workflow).toContain("actions/upload-artifact@v4");
    expect(workflow).toContain("rentauto-production-${{ env.DEPLOY_SHA }}");
    expect(workflow).toContain("dist/revision.txt");
  });

  it("diagnoses the release-pointer runtime before activation", () => {
    expect(workflow).toContain("installed release-pointer runtime");
    expect(workflow).toContain("current=");
    expect(workflow).toContain("previous=");
    expect(workflow).toContain("release directories");
  });
});
