# Rentauto ↔ TAKATAK integration

## Architectural rule

TAKATAK is the shared master platform. Rentauto is the authoritative rental vertical.

Rentauto owns rental-domain state such as vehicles, availability, quotes, trips, check-in/out, protection selections, GPS sessions, incidents and rental reviews. TAKATAK owns or projects shared identity, merchant/client context, CRM, support identity, communication and cross-product reporting.

A Rentauto booking must continue to succeed even if TAKATAK is temporarily unavailable. Synchronization therefore uses a durable outbox and retry model rather than a synchronous dependency.

## Current event contract

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

## Delivery

Rentauto stores outbound events in `public.integration_outbox`.

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
