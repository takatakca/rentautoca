# RENTAUTO Edge Functions

RENTAUTO production functions live under `supabase/functions/<slug>/index.ts`.
The canonical deployed slugs are the `rentauto-*` names below. JWT behavior is
explicitly pinned in `supabase/config.toml` and checked by CI with
`npm run qa:edge-sources`.

## Booking and payment

| Function | Auth | Purpose |
|---|---|---|
| `rentauto-quote-trip` | Public | Server-authoritative trip quote. Read-only; validates vehicle availability, extras, protection, discounts and Quebec taxes. |
| `rentauto-create-booking-draft` | JWT | Creates a user-owned draft trip and atomic booking hold from authoritative pricing. |
| `rentauto-create-checkout-session` | JWT | Prepares Stripe Checkout for an owned booking and binds the session to the trip/hold. |
| `rentauto-stripe-webhook` | Stripe signature | Idempotently finalizes paid bookings, handles checkout failures, refunds, disputes and Connect account updates. |
| `rentauto-cancel-trip` | JWT | Previews and executes policy-aware cancellation/refund workflows. |
| `rentauto-trip-transition` | JWT | Drives check-in, active-trip and check-out state transitions with evidence validation. |

### Public/custom-auth endpoints

Only these RENTAUTO functions intentionally run with `verify_jwt = false`:

- `rentauto-quote-trip`: public read-only calculation.
- `rentauto-stripe-webhook`: validates the Stripe webhook signature before processing.
- `rentauto-tracking-ingest`: validates `x-provider-secret` against `RENTAUTO_TRACKING_PROVIDER_SECRET`.

All other `rentauto-*` functions require a valid Supabase JWT.

## Host and Stripe Connect

| Function | Auth | Purpose |
|---|---|---|
| `rentauto-host-application` | JWT | Submits the authenticated user's host application. |
| `rentauto-stripe-onboard` | JWT | Creates/continues Stripe Connect onboarding for an approved host/admin. |
| `rentauto-stripe-status` | JWT | Returns live Connect capability status for the authenticated account. |
| `rentauto-stripe-dashboard` | JWT | Creates a Stripe Express/Connect dashboard login link when available. |
| `rentauto-host-booking-requests` | JWT | Host booking-request review workflow. |
| `rentauto-vehicle-documents` | JWT | Host vehicle-document submission and status workflow. |

## Verification and administration

| Function | Auth | Purpose |
|---|---|---|
| `rentauto-bootstrap-account` | JWT | Bootstraps the authenticated TAKATAK identity into the Rentauto account projection. |
| `rentauto-driver-verification` | JWT | Driver-verification status and document submission. |
| `rentauto-admin-driver-verifications` | JWT | Admin review of pending driver verification. |
| `rentauto-admin-host-applications` | JWT + admin | Admin host-application review. |
| `rentauto-admin-host-verifications` | JWT + admin | Admin host identity-document review. |
| `rentauto-admin-vehicle-reviews` | JWT + admin | Admin vehicle-document moderation. |
| `rentauto-admin-trip-incidents` | JWT + admin | Admin incident review. |
| `rentauto-admin-settlements` | JWT + admin | Settlement policy, release and reversal operations. |

## Tracking

`rentauto-tracking-ingest` accepts provider pings only when the provider secret
matches. The database RPC resolves the registered device and accepts location
updates only for an active tracking session. Invalid/unregistered devices and
out-of-range payloads are rejected.

Expected request fields include `provider`, `device_identifier`, `lat`,
`lng`, and optional speed/heading/accuracy/recorded timestamp values.

## Concierge

`rentauto-concierge` requires JWT authentication. It operates only on the
authenticated user's concierge threads and uses server-side tools for live
inventory, vehicle detail and authoritative trip pricing.

## TAKATAK synchronization

`takatak-sync-outbox` is server-to-server and intentionally does not use a
user JWT. It authenticates the TAKATAK destination with its integration secret
and delivers durable outbox events.

## Source-control rule

Do not recreate old parallel slugs such as `quote-trip`, `stripe-status`,
`stripe-onboard`, `stripe-dashboard`, `stripe-webhook`,
`tracking-ingest`, or `trip-transition`.

The `qa:edge-sources` CI guard rejects deployable legacy folders and verifies
that every frontend-invoked RENTAUTO function has canonical source plus explicit
JWT configuration.
