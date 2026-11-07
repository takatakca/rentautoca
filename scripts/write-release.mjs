import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

// Never replace an invalid supplied revision with an unrelated checkout SHA.
const revision = process.env.SOURCE_COMMIT ?? process.env.GITHUB_SHA ??
  execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();

if (!/^[a-f0-9]{40}$/i.test(revision)) {
  throw new Error("Production build requires a complete 40-character commit SHA");
}

writeFileSync(resolve("dist/revision.txt"), `${revision.toLowerCase()}\n`);
console.log(`Rentauto release: ${revision.toLowerCase()}`);
