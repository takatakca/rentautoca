# Rentauto.ca — engineering and launch documentation

Rentauto is a Canadian peer-to-peer vehicle-rental marketplace. The independent React/Vite frontend is deployed to MochaHost from GitHub Actions; its identity and backend services use the shared TAKATAK Supabase project with Rentauto-scoped rental data.

## Boundaries

- **GROUPE TAKATAK:** master identity, authorization, shared customer projections and cross-product integrations.
- **RENTAUTO:** vehicles, availability, rental quotes, booking state, payments, host payouts, check-in/out, GPS tracking, disputes, and reviews.
- **Stripe:** Checkout/Connect, payment capture and webhooks via server-side Supabase Edge Functions. Never embed secret Stripe keys in the browser.
- **MochaHost:** serves the immutable static frontend through an installed Passenger `app.js` release-pointer runtime. It does not execute the production Vite build.

## Key references

| Document | Purpose |
| --- | --- |
| [Deployment (root)](../DEPLOY_MOCHAHOST.md) | Actual GitHub CI → immutable SHA artifact → Passenger / CURRENT deploy |
| [MochaHost troubleshooting](MOCHAHOST_DEPLOYMENT.md) | cPanel binding, health checks and recovery |
| [Launch checklist](LC1_RUNBOOK.md) | End-to-end host/guest, live billing and GPS acceptance criteria |
| [API reference](API_REFERENCE.md) | Frontend to backend data flows |
| [Edge Functions](EDGE_FUNCTIONS.md) | Canonical Supabase Function slugs, authentication and contracts |
| [Booking lifecycle](BOOKING_LIFECYCLE.md) | Transactional booking state machine |
| [Tracking lifecycle](TRACKING_LIFECYCLE.md) | Active-trip tracking and privacy constraints |
| [TAKATAK integration](TAKATAK_INTEGRATION.md) | Tenant-scoped outbox and identity authority |
| [Stripe testing](STRIPE_TESTING.md) | Stripe sandbox and live-mode acceptance |
| [GPS setup](GPS_PROVIDER_SETUP.md) | Provider webhook configuration |

## Config ownership

Browser-safe build-time variables: `VITE_TAKATAK_SUPABASE_URL`, `VITE_TAKATAK_SUPABASE_PUBLISHABLE_KEY`, `VITE_TAKATAK_SUPABASE_PROJECT_ID` and `VITE_APP_URL`.

Server-only Edge Function secrets include `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PUBLIC_APP_URL` and provider secrets. Backend function deployment and database migration rollout are not part of the frontend MochaHost workflow.

**Do not follow older instructions to build manually on MochaHost or to publish via Lovable.** GitHub `main` is the source for the live frontend.
