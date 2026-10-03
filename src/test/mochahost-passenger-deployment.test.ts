import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("MochaHost Passenger deployment contracts", () => {
  const server = read("server.cjs");
  const workflow = read(".github/workflows/deploy-mochahost.yml");

  it("keeps deployment probes outside the SPA fallback", () => {
    expect(server).toContain('app.get("/healthz"');
    expect(server).toContain('app.get("/revision.txt"');
    expect(server.indexOf('app.get("/healthz"')).toBeLessThan(
      server.indexOf("SPA fallback"),
    );
    expect(server.indexOf('app.get("/revision.txt"')).toBeLessThan(
      server.indexOf("SPA fallback"),
    );
    expect(server).toContain('res.setHeader("Cache-Control", "no-store")');
  });

  it("ships the production server with each immutable frontend artifact", () => {
    expect(workflow).toContain("cp server.cjs .deploy/release/server.cjs");
    expect(workflow).toContain('test -f "$STAGE/server.cjs"');
    expect(workflow).toContain('mv "$STAGE/server.cjs" server.cjs');
  });

  it("restarts Passenger after server activation and rollback", () => {
    const restartTouches = workflow.match(/touch tmp\/restart\.txt/g) ?? [];
    expect(restartTouches.length).toBeGreaterThanOrEqual(2);
    expect(workflow).toContain('cp -a server.cjs "$BACKUP/server.cjs"');
    expect(workflow).toContain('cp -a "$BACKUP/server.cjs" server.cjs');
  });

  it("rejects SPA HTML masquerading as a healthy deployment", () => {
    expect(workflow).toContain('health_body="$(tr -d');
    expect(workflow).toContain('[ "$health_body" = "ok" ]');
    expect(workflow).toContain('if [ "$health_body" != "ok" ]');
  });

  it("captures cPanel domain and document-root diagnostics", () => {
    expect(workflow).toContain("DomainInfo domains_data");
    expect(workflow).toContain("DomainLookup getdocroots");
    expect(workflow).toContain("Passenger / Node processes");
  });
});
