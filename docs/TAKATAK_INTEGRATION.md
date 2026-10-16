# Rentauto ↔ TAKATAK integration

## Architectural rule

TAKATAK is the shared master platform. Rentauto is the authoritative rental vertical.

Rentauto owns rental-domain state such as vehicles, availability, quotes, trips, check-in/out, protection selections, GPS sessions, incidents and rental reviews. TAKATAK owns or projects shared identity, merchant/client context, CRM, support identity, communication and cross-product reporting.

A Rentauto booking must continue to succeed even if TAKATAK is temporarily unavailable. Synchronization therefore uses a durable outbox and retry model rather than a synchronous dependency.

## Current production integration (verified 2026-10-14)

- Shared project `pcjfahhlozsseqqevimi` already runs the explicit Rentauto authorization/account bootstrap which updates the TAKATAK `public.source_profiles` projection.
- `rentauto.sync_takatak_marketplace_order_trigger` invokes `rentauto.project_trip_to_takatak_marketplace_order` for non-draft trips. It writes into TAKATAK-owned `public.source_marketplace_orders` in the same database transaction.
- A separate `takatak-sync-outbox` Edge Function and its original `public.integration_outbox` table/RPCs **are not deployed**. The historical migration assumes absent `public.trips` and `public.user_roles` and modifies shared auth triggers; do not apply it unchanged (GitHub issue #39).
- Production Rentauto accounts/trips were both zero at inspection, so this installed direct projection has not been proven end-to-end with a real rental.
- Do not duplicate existing order projections or automatically enroll unrelated TAKATAK identities.

## Proposed outbound event contract (not yet deployed)

Rentauto emits privacy-minimized events with:

- `eventId`: globally unique idempotency key
- `eventType`
- `sourceApplication: "RENTAUTO"`
- `externalUserId`: Rentauto auth user UUID
- `occurredAt`: server timestamp

Initial event types:

- `CUSTOMER_REGISTERED`
- `PROFILE_UPDATED`
- `PAYMENT_SUMMARY_UPDATED`

TAKATAK stores these in its existing master identity/source synchronization models:

- `MasterIdentity`
- `SourceProfile`
- `SourceAddress`
- `SourcePaymentSummary`
- `SourceSynchronizationEvent`

## Planned outbound delivery (not yet deployed)

No active outbox is present in the production database. The contract below describes a future, separately verified sender rather than an operational integration. New designs must be Rentauto-scoped and additive; see issue #39.

The `takatak-sync-outbox` Edge Function:

1. claims retryable rows atomically;
2. signs the exact JSON body with HMAC-SHA256;
3. sends it to the TAKATAK Rentauto integration endpoint;
4. marks successful deliveries processed;
5. records safe failure text and schedules exponential retry on failure.

HMAC input:

```
{unixTimestamp}.{eventId}.{rawJsonBody}
```

Headers:

- `x-integration-id`
- `x-event-id`
- `x-timestamp`
- `x-signature: sha256=<hex>`

TAKATAK rejects stale timestamps, invalid HMAC signatures, mismatched event IDs, oversized payloads and forbidden secret fields.

## Rentauto Edge Function secrets

Configure these only as server-side Edge Function secrets:

- `TAKATAK_RENTAUTO_SYNC_URL`
- `TAKATAK_RENTAUTO_SYNC_CLIENT_ID`
- `TAKATAK_RENTAUTO_SYNC_WEBHOOK_SECRET`
- `TAKATAK_SYNC_RUNNER_SECRET`

Do not place them in Vite variables or browser code.

## TAKATAK server variables

TAKATAK uses:

- `RENTAUTO_SYNC_ENABLED`
- `RENTAUTO_SYNC_CLIENT_ID`
- `RENTAUTO_SYNC_WEBHOOK_SECRET`

The client ID and webhook secret must correspond to the Rentauto sender values.

## Sensitive data excluded

The synchronization contract must not carry:

- passwords or password hashes
- OTPs or sessions
- service-role keys
- Stripe secret keys
- full payment card data
- driver licence images
- private vehicle registration/insurance documents
- trip inspection photos
- exact GPS history
- door/alarm codes
- private booking notes

## Failure behaviour

TAKATAK downtime must never roll back a valid Rentauto rental transaction. Events remain in the outbox and retry later. TAKATAK processing is idempotent by `eventId` and payload hash.

## Next contract versions

Later versions will add controlled projections for:

- host/merchant status
- vehicle/fleet summary
- upcoming and completed trip summaries
- refunds and host payouts
- support/incident attention states
- verification/compliance summaries
- notification routing

These must use versioned contracts rather than direct cross-database table access.

## 2026-10-15 receiver contract verified in master source

The TAKATAK master repository `takatakca/takatak-v1` contains `src/app/api/integrations/rentauto/events/route.ts`, re-exporting `src/lib/integrations/rentauto/events/route.ts`. The receiver verifies `x-integration-id`, timestamp within five minutes, raw-body HMAC and matching body/header event ID. It responds with JSON `accepted: true` on accepted events; a 2xx response without this receipt is not considered delivered.

The Rentauto sender source now validates HTTPS destination at `/api/integrations/rentauto/events` and permits `takatak.ca` or its subdomains by default; staging requires explicit server-only `TAKATAK_RENTAUTO_SYNC_ALLOWED_ORIGIN`. HTTP redirects are forbidden. These checks are unit-tested. **Neither the receiver's live flag/configuration nor the sender's live deployment is confirmed**. The shared Supabase direct projection must be reconciled before a second writer is enabled.

## 2026-10-15 isolated outbox SQL staging artifact
- `supabase/staged/rentauto-takatak-outbox-v1.sql` defines disabled `rentauto.takatak_sync_settings`, `rentauto.takatak_event_outbox`, service-only claim/ack/failure RPCs and account/payment triggers only in the Rentauto schema. Last attempts become dead letters. A per-claim UUID lease prevents stale acknowledgements.
- Sender source calls `rentauto_claim_takatak_outbox`, `rentauto_mark_takatak_outbox_processed`, `rentauto_mark_takatak_outbox_failed` with `p_lock_token`; requires signed HTTPS to the verified TAKATAK route and positive receipt.
- **Not deployed**: no database SQL, backend Edge or runner secrets configured from this change. Do not enable a second master identity/payment update path until storage separation, idempotency and consent are verified in staging.

## 2026-10-15 gate and identity fallback (staging only)
- Enqueue and claim both enforce `rentauto.takatak_sync_settings.enabled`; queued events remain pending when disabled and resume only after explicit re-enablement. In-flight HTTP sends cannot be unsent.
- The account trigger matches `public.source_profiles` for `RENTAUTO` by current auth UUID or the already linked `master_identity_id`, preserving legacy external-user identities. Disposable PostgreSQL CI simulates both behaviors.

## 2026-10-16 production database identity reconciliation
- Read-only inspection of shared Supabase `pcjfahhlozsseqqevimi` revealed TAKATAK V1 Prisma migration names matching the actual master repository, together with Rentauto and `public.source_profiles`/`public.source_marketplace_orders`. This confirms one PostgreSQL authority.
- Existing `public.bootstrap_rentauto_account` and `rentauto.project_trip_to_takatak_marketplace_order` RPCs are service-role protected, and `trg_sync_takatak_marketplace_order` is installed on Rentauto trip insert/update.
- Do not activate the staged HTTP sender: redundant cross-service writes may duplicate or overwrite already projected profiles/orders. Existing direct projection is canonical unless an independently verified second datastore is introduced.
- New isolated CI job exercises the actual versioned direct order trigger SQL for draft suppression, identity linkage, idempotent payment/refund status changes and customer separation. A green test does not replace real Stripe/GPS acceptance.
