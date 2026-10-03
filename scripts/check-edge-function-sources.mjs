import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const functionsRoot = path.join(root, "supabase", "functions");
const srcRoot = path.join(root, "src");
const configPath = path.join(root, "supabase", "config.toml");

const customAuth = new Set([
  "rentauto-quote-trip",
  "rentauto-stripe-webhook",
  "rentauto-tracking-ingest",
  "takatak-sync-outbox",
]);

function walk(directory, predicate, output = []) {
  if (!fs.existsSync(directory)) return output;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute, predicate, output);
    else if (predicate(absolute)) output.push(absolute);
  }
  return output;
}

const invoked = new Set();
for (const file of walk(srcRoot, (file) => /\.(ts|tsx)$/.test(file))) {
  const source = fs.readFileSync(file, "utf8");
  const regex = /\.functions\.invoke\(\s*["'`]([^"'`]+)["'`]/g;
  for (const match of source.matchAll(regex)) {
    if (match[1].startsWith("rentauto-")) invoked.add(match[1]);
  }
}

for (const required of ["rentauto-stripe-webhook", "rentauto-tracking-ingest"]) {
  invoked.add(required);
}

const canonical = new Set(
  fs
    .readdirSync(functionsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => name.startsWith("rentauto-")),
);

const failures = [];
for (const slug of [...invoked].sort()) {
  const entry = path.join(functionsRoot, slug, "index.ts");
  if (!fs.existsSync(entry)) {
    failures.push("missing source for invoked function " + slug + ": " + path.relative(root, entry));
  }
}

for (const slug of [...canonical].sort()) {
  if (!fs.existsSync(path.join(functionsRoot, slug, "index.ts"))) {
    failures.push("canonical function directory has no index.ts: " + slug);
  }
}

const legacy = fs
  .readdirSync(functionsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter(
    (name) =>
      !name.startsWith("_") &&
      !name.startsWith("rentauto-") &&
      name !== "takatak-sync-outbox",
  )
  .filter((name) => fs.existsSync(path.join(functionsRoot, name, "index.ts")));

if (legacy.length > 0) {
  failures.push("legacy deployable function directories remain: " + legacy.join(", "));
}

const config = fs.readFileSync(configPath, "utf8");
for (const slug of [...canonical].sort()) {
  const escaped = slug.replace(/[.*+?^()|[\]\\$]/g, "\\$&");
  const match = config.match(
    new RegExp(
      "\\[functions\\." + escaped + "\\]\\s*\\nverify_jwt\\s*=\\s*(true|false)",
      "m",
    ),
  );

  if (!match) {
    failures.push("missing explicit Supabase JWT config for " + slug);
    continue;
  }

  const configured = match[1] === "true";
  const expected = !customAuth.has(slug);
  if (configured !== expected) {
    failures.push(
      "wrong verify_jwt for " + slug + ": expected " + expected + ", got " + configured,
    );
  }
}

const outboxMatch = config.match(
  /\[functions\.takatak-sync-outbox\]\s*\nverify_jwt\s*=\s*(true|false)/m,
);
if (!outboxMatch || outboxMatch[1] !== "false") {
  failures.push("takatak-sync-outbox must remain custom-authenticated");
}

if (failures.length > 0) {
  console.error("Edge source parity guard failed:");
  for (const failure of failures) console.error(" - " + failure);
  process.exit(1);
}

console.log(
  "Edge source parity guard passed: " +
    canonical.size +
    " canonical Rentauto functions, " +
    invoked.size +
    " invoked/external functions checked.",
);
