import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("Rentauto cancellation/refund authority contracts", () => {
  const migration = read(
    "supabase/migrations/20261001050000_rentauto_trip_cancellations.sql",
  );
  const cancelEdge = read(
    "supabase/functions/rentauto-cancel-trip/index.ts",
  );
  const stripeWebhook = read(
    "supabase/functions/rentauto-stripe-webhook/index.ts",
  );

  it("never releases a paid booking before a required refund succeeds", () => {
    expect(migration).toContain("refund_not_succeeded");
    expect(migration).toContain("DELETE FROM rentauto.availability_blocks");
    expect(migration.indexOf("refund_not_succeeded")).toBeLessThan(
      migration.indexOf("DELETE FROM rentauto.availability_blocks"),
    );
  });

  it("requires manual approvals to be full refunds", () => {
    expect(migration).toContain("manual_resolution_requires_full_refund");
    expect(migration).toContain(
      "p_refund_amount_cents <> v_cancel.original_total_cents",
    );
    expect(migration).toContain("refund_percentage = CASE");
    expect(migration).toContain("THEN 100");
  });

  it("locks refund creation to an idempotency key and supports provider reconciliation", () => {
    expect(cancelEdge).toContain("idempotencyKey");
    expect(cancelEdge).toContain('resumeMode === "retrieve"');
    expect(cancelEdge).toContain("stripe.refunds.retrieve");
    expect(cancelEdge).toContain("stripe.refunds.create");
    expect(migration).toContain("'rentauto-cancel-'");
    expect(migration).toContain("refund_idempotency_conflict");
  });

  it("keeps undefined policy outcomes in manual review", () => {
    expect(migration).toContain("policy_rule_not_automatic");
    expect(migration).toContain("outside_automatic_refund_window");
    expect(migration).toContain("'manual_review'");
    expect(migration).toContain("cancellation_manual_review_requested");
  });

  it("synchronizes asynchronous Stripe refund status through the webhook", () => {
    expect(stripeWebhook).toContain('case "refund.updated":');
    expect(stripeWebhook).toContain('case "refund.failed":');
    expect(stripeWebhook).toContain("sync_trip_cancellation_refund");
  });

  it("preserves the booking when a refund is pending or failed", () => {
    expect(migration).toContain("'refund_pending'");
    expect(migration).toContain("'failed'");
    expect(migration).toContain("RETURN rentauto.finalize_trip_cancellation");
    expect(migration.indexOf("'refund_pending'")).toBeLessThan(
      migration.indexOf("CREATE OR REPLACE FUNCTION rentauto.record_trip_cancellation_refund"),
    );
  });

  it("blocks normal cancellation after the active trip boundary", () => {
    expect(migration).toContain(
      "IF v_trip.status IN ('active','check_out_pending','completed','disputed')",
    );
    expect(migration).toContain("trip_not_cancellable");
  });

  it("keeps cancellation RPCs server-side", () => {
    for (const signature of [
      "rentauto.preview_trip_cancellation(uuid, uuid)",
      "rentauto.finalize_trip_cancellation(uuid, text)",
      "rentauto.prepare_trip_cancellation(uuid, uuid, text)",
      "rentauto.sync_trip_cancellation_refund(text, text, text)",
      "rentauto.record_trip_cancellation_refund(uuid, text, text)",
      "rentauto.prepare_cancellation_retry(uuid, uuid)",
    ]) {
      expect(migration).toContain(`REVOKE ALL ON FUNCTION ${signature}`);
    }
  });
});
