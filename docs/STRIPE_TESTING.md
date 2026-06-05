# Stripe Testing

Before LC1, validate the **full payment loop** in test mode, then a single
real $1 transaction in live mode.

## Required secrets (already configured)

- `STRIPE_SECRET_KEY` — Edge Function secret
- `STRIPE_WEBHOOK_SECRET` — Edge Function secret
- `PUBLIC_APP_URL` — for success/cancel URLs

## Test cards

| Scenario | Card |
|---|---|
| Success | `4242 4242 4242 4242`, any future date, any CVC |
| Decline (generic) | `4000 0000 0000 0002` |
| Requires authentication (3DS) | `4000 0025 0000 3155` |
| Insufficient funds | `4000 0000 0000 9995` |

Use any postal code, any name.

## Webhook test

1. Stripe Dashboard → Developers → Webhooks → add endpoint:
   `https://<project-ref>.functions.supabase.co/stripe-webhook`
2. Subscribe to:
   `checkout.session.completed`, `checkout.session.expired`,
   `checkout.session.async_payment_failed`,
   `payment_intent.succeeded`, `payment_intent.payment_failed`,
   `account.updated`, `account.application.deauthorized`,
   `charge.dispute.created`.
3. Copy the signing secret → set as `STRIPE_WEBHOOK_SECRET`.
4. "Send test webhook" → check Edge Function logs for `received: true`.

## Expected trip status changes

| Event | `trips.status` | `trips.payment_status` |
|---|---|---|
| Checkout session created | `pending_payment` | `pending` |
| `checkout.session.completed` | `confirmed` | `paid` |
| `checkout.session.expired` | `draft` | `failed` |
| `async_payment_failed` | `draft` | `failed` |
| Refund issued (Dashboard) | `cancelled` (manual) | `refunded` |

## Live $1 test (LC1)

1. Set Stripe Dashboard to **Live mode**.
2. Create a real car with `daily_rate_cents = 100`.
3. Book 1 day with a real card.
4. Verify webhook fires, trip flips to `confirmed`, availability blocked.
5. Refund from Stripe Dashboard → verify trip back to `cancelled`/`refunded`.

## Troubleshooting

- **Trip stuck in `pending_payment`** → check webhook delivery in Stripe
  Dashboard → re-send event; check `stripe_webhook_events` table for the
  event id and Edge Function logs.
- **Signature verification fails** → wrong `STRIPE_WEBHOOK_SECRET` for the
  active endpoint; live and test endpoints have different secrets.
- **`PAYMENT_NOT_CONFIGURED`** → `STRIPE_SECRET_KEY` missing.
- **Success URL 404** → `PUBLIC_APP_URL` not set or wrong domain.
