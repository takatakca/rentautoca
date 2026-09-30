import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

type OutboxRow = {
  id: string;
  event_id: string;
  payload_json: unknown;
  attempt_count: number;
};

const jsonHeaders = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

async function sha256(value: string): Promise<Uint8Array> {
  const bytes = new TextEncoder().encode(value);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
}

async function constantTimeEqual(a: string, b: string): Promise<boolean> {
  const [left, right] = await Promise.all([sha256(a), sha256(b)]);
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let i = 0; i < left.length; i += 1) mismatch |= left[i] ^ right[i];
  return mismatch === 0;
}

async function hmacHex(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)),
  );
  return Array.from(signature, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const targetUrl = Deno.env.get("TAKATAK_RENTAUTO_SYNC_URL");
  const clientId = Deno.env.get("TAKATAK_RENTAUTO_SYNC_CLIENT_ID");
  const webhookSecret = Deno.env.get("TAKATAK_RENTAUTO_SYNC_WEBHOOK_SECRET");
  const runnerSecret = Deno.env.get("TAKATAK_SYNC_RUNNER_SECRET");

  if (!supabaseUrl || !serviceKey) {
    console.error("[takatak-sync] Supabase service configuration missing");
    return json({ error: "Service unavailable" }, 503);
  }

  const suppliedRunnerSecret = req.headers.get("x-sync-runner-secret") ?? "";
  if (
    !runnerSecret ||
    !suppliedRunnerSecret ||
    !(await constantTimeEqual(suppliedRunnerSecret, runnerSecret))
  ) {
    return json({ error: "Unauthorized" }, 401);
  }

  if (!targetUrl || !clientId || !webhookSecret) {
    console.error("[takatak-sync] TAKATAK integration configuration missing");
    return json({ error: "Integration not configured" }, 503);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const requestedLimit = Number(new URL(req.url).searchParams.get("limit") ?? "20");
  const batchSize = Number.isInteger(requestedLimit)
    ? Math.min(100, Math.max(1, requestedLimit))
    : 20;

  const { data, error } = await admin.rpc("claim_takatak_outbox", {
    p_limit: batchSize,
  });

  if (error) {
    console.error("[takatak-sync] Failed to claim outbox", error.message);
    return json({ error: "Unable to claim synchronization work" }, 500);
  }

  const rows = (data ?? []) as OutboxRow[];
  let processed = 0;
  let failed = 0;

  for (const row of rows) {
    const rawBody = JSON.stringify(row.payload_json);
    const timestamp = Math.floor(Date.now() / 1000).toString();

    try {
      const signature = await hmacHex(
        webhookSecret,
        `${timestamp}.${row.event_id}.${rawBody}`,
      );

      const response = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-integration-id": clientId,
          "x-event-id": row.event_id,
          "x-timestamp": timestamp,
          "x-signature": `sha256=${signature}`,
        },
        body: rawBody,
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        const safeMessage = `TAKATAK returned HTTP ${response.status}`;
        await admin.rpc("mark_takatak_outbox_failed", {
          p_id: row.id,
          p_error: safeMessage,
        });
        failed += 1;
        continue;
      }

      const { error: markError } = await admin.rpc("mark_takatak_outbox_processed", {
        p_id: row.id,
      });

      if (markError) {
        console.error("[takatak-sync] Delivery succeeded but marking failed", row.id);
        failed += 1;
        continue;
      }

      processed += 1;
    } catch (cause) {
      const safeMessage =
        cause instanceof DOMException && cause.name === "TimeoutError"
          ? "TAKATAK request timed out"
          : "TAKATAK delivery failed";

      await admin.rpc("mark_takatak_outbox_failed", {
        p_id: row.id,
        p_error: safeMessage,
      });
      failed += 1;
    }
  }

  return json({
    ok: failed === 0,
    claimed: rows.length,
    processed,
    failed,
  }, failed === 0 ? 200 : 207);
});
