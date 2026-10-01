# Edge Functions

All functions live in `supabase/functions/<name>/index.ts` and run on
Supabase Edge Runtime (Deno). JWT verification per function is configured in
`supabase/config.toml`.

---

## `quote-trip`

- **Purpose:** Compute a priced quote for a `car_id` + date range + extras.
- **Auth:** Public (`verify_jwt = false`). Read-only; no DB writes.
- **Input:**
  ```json
  { "car_id": "uuid", "start_at": "ISO", "end_at": "ISO",
    "protection_plan": "basic|silver|gold", "extras": ["..."] }
  ```
- **Output:** `{ subtotal_cents, fees_cents, tax_cents, total_cents, currency, breakdown }`.
- **Errors:** `400` invalid dates, `404` car not found, `409` dates unavailable.
- **Security:** No PII, no writes. Re-validates availability before returning.

---

## `create-checkout-session`

- **Purpose:** Convert a draft trip into a Stripe Checkout session.
- **Auth:** Bearer JWT required; resolves user via `getClaims`.
- **Input:** `{ tripId, returnUrl? }`.
- **Output:** `{ url, session_id }`.
- **Side effects:** Sets `trips.status = pending_payment`,
  stores `stripe_session_id`.
- **Errors:** `401` no auth, `404` trip not owned, `400` wrong status,
  `409` dates no longer available, `503` `PAYMENT_NOT_CONFIGURED`.
- **Security:** Re-checks `availability_blocks` server-side; owner check
  against `trips.guest_id == auth user`.

---

## `stripe-webhook`

- **Purpose:** Receive Stripe events for Connect + Checkout + disputes.
- **Auth:** Public (`verify_jwt = false`) — verified via Stripe signature
  using `STRIPE_WEBHOOK_SECRET`.
- **Input:** Raw Stripe event JSON + `stripe-signature` header.
- **Output:** `200 { received: true }` or `400` invalid signature.
- **Handled events:**
  - `account.updated` → updates `stripe_accounts.charges_enabled / payouts_enabled`.
  - `account.application.deauthorized` → clears row.
  - `checkout.session.completed` → trip `confirmed`, inserts `availability_blocks`.
  - `checkout.session.expired` / `async_payment_failed` → atomic checkout failure; trip `cancelled`, payment `failed`, hold released.
  - `charge.refunded` → refund totals/payment projection synchronized.
  - `refund.updated|failed` → cancellation refund state synchronized.
  - `charge.dispute.created|updated|closed` → dispute + settlement hold/reversal state synchronized.
  - `payment_intent.succeeded|failed` → booking state remains authoritative from Checkout session events.
- **Idempotency:** `stripe_webhook_events` table deduplicates by `stripe_event_id`.

---

## `trip-transition`

- **Purpose:** Drive the physical trip lifecycle only.
- **Auth:** Bearer JWT required.
- **Actions:** `start_check_in`, `complete_check_in`,
  `start_check_out`, `complete_check_out`.
- **Authority:** PostgreSQL validates the participant, driver verification,
  mandatory handoff evidence, odometer/fuel data, and trip status order.
- **Cancellation is not handled here.** Use `rentauto-cancel-trip` so policy
  evaluation, Stripe refund idempotency, settlement holds and audit records
  remain atomic.

---

## `rentauto-cancel-trip`

- **Purpose:** Preview and execute pre-trip cancellation/refund workflows.
- **Auth:** Bearer JWT required.
- **Participant actions:** `preview`, `cancel`.
- **Admin actions:** `list`, `resolve`, `retry`.
- **Behavior:** Uses the immutable policy snapshot saved on the booking.
  Explicit covered rules can auto-refund; undefined cases enter
  `manual_review`. Paid refunds use Stripe idempotency keys stored in
  `trip_cancellations`.
- **Safety:** The vehicle remains reserved until a required refund is safely
  confirmed. Active/completed/disputed trips cannot use normal cancellation.

---

## `tracking-ingest`

- **Purpose:** Receive GPS pings from registered devices.
- **Auth:** Public (`verify_jwt = false`), but requires
  `x-tracking-secret: <RENTAUTO_TRACKING_PROVIDER_SECRET>` header.
- **Input:** `{ device_id, lat, lng, speed_kmh?, heading?, recorded_at }`.
- **Output:** `200 { stored: true|false }`.
- **Behavior:** Looks up `vehicle_tracking_devices`, finds the **active**
  `trip_tracking_sessions` row for that car. If none active → drops the ping.
  If active → inserts a `vehicle_location_events` row and updates device last-seen.
- **Security:** Shared secret + active-session gate enforce that location is
  only stored while a trip is in progress (privacy by design).

---

## Supporting Stripe Connect functions

| Function | Auth | Purpose |
|---|---|---|
| `stripe-onboard` | JWT | Creates Connect Account Link for host onboarding. |
| `stripe-status` | JWT | Returns `charges_enabled` / `payouts_enabled` for host. |
| `stripe-dashboard` | JWT | Returns Stripe Express dashboard login link. |

## `seed-demo`

- Dev-only. Seeds demo cars/photos/provinces. Do NOT call in production.
