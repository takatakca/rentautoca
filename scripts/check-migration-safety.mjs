import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Legacy migrations are kept for history, but this shared TAKATAK production
 * project no longer has the public.trips/public.user_roles schema they target.
 * Fail closed before an automated backend rollout can replay them.
 */
const forbiddenMigration = "20260930161000_takatak_integration_outbox.sql";
const migrations = readdirSync(join(process.cwd(), "supabase/migrations"));
const legacy = migrations.find((filename) => filename === forbiddenMigration);
if (!legacy) throw new Error("Historical outbox migration moved: reconcile the protection");

const contents = readFileSync(join(process.cwd(), "supabase/migrations", legacy), "utf8");
if (!contents.includes("CREATE OR REPLACE FUNCTION public.handle_new_user")) {
  throw new Error("Historical outbox migration changed: review its safety guard");
}

const liveConfig = readFileSync(join(process.cwd(), "supabase/config.toml"), "utf8");
if (!liveConfig.includes('project_id = "pcjfahhlozsseqqevimi"')) {
  throw new Error("Supabase project identity changed: review migration rollout first");
}

const workflow = readFileSync(join(process.cwd(), ".github/workflows/ci.yml"), "utf8");
if (!workflow.includes("node scripts/check-migration-safety.mjs")) {
  throw new Error("CI must enforce migration safety");
}

// No production backend database deploy workflow is permitted to apply the
// historical migration. When adding deployment automation, explicitly filter
// this file and reconcile migrations against the live schema first.
for (const file of readdirSync(join(process.cwd(), ".github/workflows"))) {
  if (!file.endsWith(".yml") && !file.endsWith(".yaml")) continue;
  const source = readFileSync(join(process.cwd(), ".github/workflows", file), "utf8");
  const dangerous = /supabase\s+db\s+push|supabase\s+migration\s+up|supabase\s+db\s+reset/i.test(source);
  if (dangerous) {
    throw new Error(`Database auto-rollout in ${file} requires a reviewed migration gate`);
  }
}
console.log("Shared TAKATAK migration guard passed; historical outbox migration remains blocked.");
