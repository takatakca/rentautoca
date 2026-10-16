# RENTAUTO.CA — PRIORITY TASK QUEUE
Maintained newest first. One agent claims a task in `WORKLOG.md` before editing.

| Priority | Task | Status | Acceptance |
| --- | --- | --- | --- |
| P0 | #39 reconcile TAKATAK outbox with shared schema | blocked / in development | Non-destructive Rentauto-scoped migration; verify in staging; confirmed receiver/HMAC and runner secrets; deploy Edge + migrations; replay/idempotency tests |
| P0 | Intermittent MochaHost SSH command/upload reliability | in progress | Retry with hash verification, observe successful final live SHA; host SSH exec access may require operator fix |
| P0 | LC1 real rental loop | pending operational acceptance | Real verified host/guest, inventory, booking, Stripe test/live payments, refund, GPS, check-in/out, review and admin sign-off |
| P0 | Auth, Stripe, provider secrets and redirect verification | pending read-only operator validation | Phone OTP delivered, correct redirect, Edge Function auth and webhook signatures work on live |
| P1 | Privacy/RLS audit on rentauto schema and Edge functions | in progress (frontend role gate fixed) | Tests of owner/host/admin isolation, sensitive uploads, GPS privacy gate |
| P1 | Expand integration/quote/refund/role automated tests | pending | CI tests cover high-risk failures and replays |
| P1 | Update manual docs and remove obsolete assumptions | in progress | One deploy/runbook source of truth; no wrong schema, build or service instructions |
| Done | SEO private-route noindex, immutable MochaHost release pinning, CI | done | Github runs 38608642413 and 38608765943 passed at `98969f648124fac7eb4dc54e14158451246bf72a` |

Do not close blockers solely from successful frontend builds. Report only actual confirmations.

## Blocking deployment evidence (2026-10-14)

Issue #40: SSH authenticated but remote command channel rejected. GitHub build/test passes for code SHA `32d615164bf09f0c6778bccb7b6c340fd0f2972b`, but production cannot be reported updated until MochaHost accepts remote exec and health reports the exact SHA. Continue independent code work while the hosting permission problem is resolved; do not bypass security or repeatedly dispatch the same failing command without a new correction.

## 2026-10-15 priority update
- [x] Add automated guard preventing unsafe historical migration replay in current CI.
- [ ] #40 Restore reliable MochaHost command execution; then deploy the newest successful `main` SHA and verify live `/healthz`.
- [ ] #39 Reconcile existing direct TAKATAK projections with any proposed outbox before enabling a second delivery path. Stage and review RLS, grants, HMAC and idempotency.
- [ ] LC1 run a real host/guest/Stripe/tracking/refund scenario; production validation remains unverified.

## 2026-10-15 transport milestone
- [x] Review TAKATAK master HMAC receiver and build sender SSRF/redirect and ack protections with tests.
- [ ] #39 Replace obsolete historical outbox migration with Rentauto-scoped staged SQL and confirm receiver storage separation to avoid duplicated master projections.
- [ ] Configure and test secrets, scheduler, replay/idempotent delivery in staging before backend function deployment.
- [ ] #40 Follow intermittent SSH health, previous run 38841341501 succeeded; do not assume permanent host remediation.

## 2026-10-15 scoped outbox progress
- [x] Prepare default-off, Rentauto-only outbox SQL, lease tokens, dead-letter and narrow account/payment trigger sources; update sender and tests.
- [ ] Staging DB integration tests for RLS, idempotency, race/expired leases and lifecycle.
- [ ] Confirm TAKATAK receiver and shared database do not duplicate projections; reconcile old migration history; configure secrets and explicitly enable only after staging.

## 2026-10-15 CI staging
- [x] Add isolated Postgres SQL integration job to CI; runner refuses any database name besides `rentauto_outbox_ci`.
- [ ] Confirm job passes, then independently exercise schema-aligned isolated Supabase before any production migration/Edge activation.

## 2026-10-15 regression coverage
- [x] Add kill-switch protection to outbox claim and legacy-master-identity fallback for Rentauto-only account events.
- [x] Extend disposable PostgreSQL validation to assert disabled backlog stays pending and resumes after enabled.
- [ ] Verify new CI run and production frontend revision; keep backend activation pending actual schema/receiver validation.
