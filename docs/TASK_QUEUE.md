# RENTAUTO.CA — PRIORITY TASK QUEUE
Maintained newest first. One agent claims a task in `WORKLOG.md` before editing.

| Priority | Task | Status | Acceptance |
| --- | --- | --- | --- |
| P0 | #39 reconcile TAKATAK outbox with shared schema | blocked / in development | Non-destructive Rentauto-scoped migration; verify in staging; confirmed receiver/HMAC and runner secrets; deploy Edge + migrations; replay/idempotency tests |
| P0 | LC1 real rental loop | pending operational acceptance | Real verified host/guest, inventory, booking, Stripe test/live payments, refund, GPS, check-in/out, review and admin sign-off |
| P0 | Auth, Stripe, provider secrets and redirect verification | pending read-only operator validation | Phone OTP delivered, correct redirect, Edge Function auth and webhook signatures work on live |
| P1 | Privacy/RLS audit on rentauto schema and Edge functions | pending | Tests of owner/host/admin isolation, sensitive uploads, GPS privacy gate |
| P1 | Expand integration/quote/refund/role automated tests | pending | CI tests cover high-risk failures and replays |
| P1 | Update manual docs and remove obsolete assumptions | in progress | One deploy/runbook source of truth; no wrong schema, build or service instructions |
| Done | SEO private-route noindex, immutable MochaHost release pinning, CI | done | Github runs 38608642413 and 38608765943 passed at `98969f648124fac7eb4dc54e14158451246bf72a` |

Do not close blockers solely from successful frontend builds. Report only actual confirmations.
