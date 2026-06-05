# Rentauto.ca — Developer & Operator Docs

Rentauto is a peer-to-peer car rental marketplace for Canada (CAD only),
modeled after Turo. This folder is the source of truth for engineers and
operators preparing the platform for Launch Candidate 1 (LC1) and beyond.

## Architecture at a glance

```
┌──────────────────────────┐      ┌────────────────────────────┐
│   React + Vite SPA       │      │   Supabase (Lovable Cloud) │
│   (served by server.cjs  │ ───▶ │   - Postgres + RLS         │
│    on MochaHost)         │      │   - Auth (email + Google)  │
│                          │      │   - Storage buckets        │
│   - React Router         │      │   - Edge Functions (Deno)  │
│   - Tailwind + shadcn    │      │   - Realtime (tracking)    │
│   - TanStack Query       │      └──────────┬─────────────────┘
└──────────────────────────┘                 │
                                             ▼
                                    ┌─────────────────────┐
                                    │ Stripe (Connect +   │
                                    │ Checkout + Webhook) │
                                    └─────────────────────┘
                                             │
                                             ▼
                                    ┌─────────────────────┐
                                    │ GPS provider        │
                                    │ (Bouncie / Geotab)  │
                                    └─────────────────────┘
```

## Key documents

| File | Purpose |
|---|---|
| `API_REFERENCE.md` | Frontend → backend data flows by feature |
| `EDGE_FUNCTIONS.md` | All Supabase Edge Functions, auth, I/O, errors |
| `BOOKING_LIFECYCLE.md` | Trip state machine + side effects |
| `TRACKING_LIFECYCLE.md` | When GPS is on/off + privacy rules |
| `STRIPE_TESTING.md` | Test cards, webhook test, $1 live test |
| `GPS_PROVIDER_SETUP.md` | Registering devices + webhook contract |
| `MOCHAHOST_DEPLOYMENT.md` | cPanel Node app deploy reference |
| `LC1_RUNBOOK.md` | Step-by-step launch candidate test script |

## Important environment variables

**Frontend (build-time, safe to ship):**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`
- `VITE_APP_URL` — canonical base URL for SEO + Stripe success/cancel

**Edge Function secrets (server-only, never exposed):**
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `PUBLIC_APP_URL`
- `TRACKING_PROVIDER_SECRET` (shared secret for GPS provider webhooks)
- `SUPABASE_SERVICE_ROLE_KEY` (auto-provided)

## ⚠️ No secrets in the frontend

The Stripe Node SDK and any service-role key MUST live exclusively in
Edge Functions. The frontend imports `@/integrations/supabase/client` only,
which carries the publishable anon key. Grep before shipping:

```bash
rg -n "stripe" src/        # should return 0 hits
rg -n "service_role" src/  # should return 0 hits
```
