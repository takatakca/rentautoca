import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(join(process.cwd(), "supabase/staged/rentauto-takatak-outbox-v1.sql"), "utf8");
const sender = readFileSync(join(process.cwd(), "supabase/functions/takatak-sync-outbox/index.ts"), "utf8");

describe("Rentauto-staged outbox and sender contract", () => {
  it("is disabled by default and never mutates global auth/TAKATAK projections", () => {
    expect(sql).toContain("enabled boolean NOT NULL DEFAULT false");
    expect(sql).toContain("rentauto.takatak_event_outbox");
    expect(sql).toContain("rentauto.accounts");
    expect(sql).toContain("rentauto.trips");
    expect(sql).not.toMatch(/CREATE OR REPLACE FUNCTION public\.handle_new_user/i);
    expect(sql).not.toMatch(/(?:AFTER INSERT|AFTER UPDATE) ON (?:auth\.users|public\.profiles)/i);
  });
  it("enforces RLS, service-only execution, concurrent claim fencing and dead letters", () => {
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("FROM PUBLIC,anon,authenticated");
    expect(sql).toContain("TO service_role");
    expect(sql).toContain("FOR UPDATE SKIP LOCKED");
    expect(sql).toContain("WHERE singleton=true AND enabled=true");
    expect(sql).toContain('sp."identityId"=NEW.master_identity_id');
    expect(sql).toContain("lock_token=p_lock_token");
    expect(sql).toContain("attempt_count>=12 THEN 'dead'");
  });
  it("keeps claim and acknowledgements bound to the new scoped RPCs", () => {
    expect(sender).toContain('admin.rpc("rentauto_claim_takatak_outbox"');
    expect(sender).toContain('admin.rpc("rentauto_mark_takatak_outbox_processed"');
    expect(sender).toContain('admin.rpc("rentauto_mark_takatak_outbox_failed"');
    expect(sender).toContain("p_lock_token: row.lock_token");
    expect(sender).toContain("marked !== true");
  });
});
