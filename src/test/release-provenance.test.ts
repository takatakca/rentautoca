import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const temporary: string[] = [];
const children: ChildProcess[] = [];
const sha = "a".repeat(40);
const otherSha = "b".repeat(40);
const script = resolve("scripts/write-release.mjs");
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "rentauto-release-"));
  temporary.push(dir);
  mkdirSync(join(dir, "dist"));
  writeFileSync(join(dir, "dist/index.html"), "<h1>Rentauto fixture</h1>");
  return dir;
}
function environment(values: Record<string, string>) {
  const env = { ...process.env };
  delete env.SOURCE_COMMIT;
  delete env.GITHUB_SHA;
  return { ...env, ...values };
}
afterEach(async () => {
  for (const child of children.splice(0)) {
    if (child.exitCode === null && child.signalCode === null) {
      const stopped = once(child, "exit");
      child.kill();
      await stopped;
    }
  }
  for (const dir of temporary.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("release provenance", () => {
  it("stamps Coolify's requested revision instead of an unrelated Actions revision", () => {
    const cwd = fixture();
    execFileSync(process.execPath, [script], { cwd, env: environment({ SOURCE_COMMIT: sha, GITHUB_SHA: otherSha }) });
    expect(readFileSync(join(cwd, "dist/revision.txt"), "utf8")).toBe(`${sha}\n`);
  });
  it("supports Actions builds and refuses a malformed supplied Coolify SHA", () => {
    const cwd = fixture();
    execFileSync(process.execPath, [script], { cwd, env: environment({ GITHUB_SHA: otherSha }) });
    expect(readFileSync(join(cwd, "dist/revision.txt"), "utf8")).toBe(`${otherSha}\n`);
    expect(() => execFileSync(process.execPath, [script], {
      cwd, env: environment({ SOURCE_COMMIT: "HEAD", GITHUB_SHA: otherSha }), stdio: "pipe",
    })).toThrow();
  });
  it("serves current and missing revisions without caching or SPA fallback", async () => {
    const cwd = fixture();
    writeFileSync(join(cwd, "server.cjs"), readFileSync(resolve("server.cjs")));
    symlinkSync(resolve("node_modules"), join(cwd, "node_modules"), "dir");
    writeFileSync(join(cwd, "dist/revision.txt"), `${sha}\n`);
    const child = spawn(process.execPath, ["server.cjs"], {
      cwd, env: { ...process.env, PORT: "0" }, stdio: ["ignore", "pipe", "pipe"],
    });
    children.push(child);
    const port = await new Promise<string>((resolvePort, reject) => {
      child.once("error", reject);
      child.once("exit", code => reject(new Error(`Server exited: ${code}`)));
      let output = "";
      child.stdout!.on("data", chunk => {
        output += chunk.toString();
        const match = output.match(/listening on port (\d+)/);
        if (match) resolvePort(match[1]);
      });
    });
    const url = `http://127.0.0.1:${port}`;
    const response = await fetch(`${url}/revision.txt`);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toBe(`${sha}\n`);
    rmSync(join(cwd, "dist/revision.txt"));
    const missing = await fetch(`${url}/revision.txt`);
    expect(missing.status).toBe(404);
    expect(missing.headers.get("cache-control")).toBe("no-store");
    expect(await missing.text()).toBe("revision missing");
    const health = await fetch(`${url}/healthz`);
    expect(health.status).toBe(200);
    expect(await health.text()).toBe("ok");
  });
});
