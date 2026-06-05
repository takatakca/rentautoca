# Booking Lifecycle

The `trips.status` column is the authoritative state. All transitions go
through `trip-transition` or `stripe-webhook` — the frontend never mutates
`status` directly.

## State machine

```
                  ┌────────┐
                  │ draft  │  ← quote created, no payment
                  └───┬────┘
                      │ create-checkout-session
                      ▼
              ┌──────────────────┐
              │ pending_payment  │  ← Stripe Checkout in progress
              └────┬─────────┬───┘
       checkout    │         │ session expired / failed
       completed   │         │
                   ▼         └──────► draft
            ┌────────────┐
            │ confirmed  │  ← availability_block inserted
            └─────┬──────┘
                  │ guest arrives → check-in form
                  ▼
         ┌────────────────────┐
         │ check_in_pending   │  (transient; UI shows action)
         └─────────┬──────────┘
                   │ trip-transition: check_in
                   ▼
              ┌─────────┐
              │ active  │  ← tracking session OPENS here
              └────┬────┘
                   │ trip-transition: check_out
                   ▼
         ┌─────────────────────┐
         │ check_out_pending   │  (transient)
         └─────────┬───────────┘
                   │
                   ▼
             ┌───────────┐
             │ completed │  ← tracking session CLOSES, review allowed
             └───────────┘

Side branches (from any pre-active state):
   any  ──► cancelled  (guest or host cancels; refund per policy)
   any  ──► disputed   (admin sets after Stripe dispute or incident)
```

## Invalid transitions (rejected by `trip-transition`)

- `draft → active` (must pay first)
- `confirmed → completed` (must check in/out)
- `completed → active` (terminal)
- `cancelled → *` (terminal except admin re-open)
- `active → draft` (never)

## Side effects

| Transition | Side effects |
|---|---|
| `draft → pending_payment` | `stripe_session_id` set, `payment_status = pending` |
| `pending_payment → confirmed` | INSERT `availability_blocks` (type=`booking_self`), `payment_status = paid` |
| `confirmed → active` | INSERT `trip_tracking_sessions` (status=`active`), `trip_events.type = check_in` |
| `active → completed` | UPDATE tracking session `status = ended`, `trip_events.type = check_out` |
| `* → cancelled` | DELETE `availability_blocks` for this trip; refund flow via Stripe |

## What writes `trip_events`

- Every successful `trip-transition` call inserts an immutable event row.
- Stripe webhook inserts `payment_*` events.
- `trip_incidents` creation inserts `incident_reported` event.
- Used for audit log shown on `TripDetail`.

## What creates `availability_blocks`

- `stripe-webhook` on `checkout.session.completed` (type `booking_self`).
- Host manual block from `HostCarEdit` (type `manual`).
- Removed on cancellation.
