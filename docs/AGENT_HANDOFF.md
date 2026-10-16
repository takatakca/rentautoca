# RENTAUTO.CA — AGENT HANDOFF
Updated: 2026-10-14 UTC. **Read this before coding, then refresh from GitHub and production.**

## Latest completed action
- Audited `main`, AGENTS/WORKLOG, issue #39 and the live Supabase schema. Added these five canonical continuity files and an AGENTS rule for next agents.
- Previous runtime commits `ced1976f8b1edf4ff0b20215e6e745ba7a934d91`, `f6de28881a6db8134ff1adbfa3c15c8261877b47` and `98969f648124fac7eb4dc54e14158451246bf72a` had green CI and successful MochaHost deploy runs.

## Current task
- Issue https://github.com/takatakca/rentautoca/issues/39 — safely reconcile Rentauto → TAKATAK outbox and verify it without breaking the shared project.

## Files changed by this task
- `AGENTS.md`, `WORKLOG.md`
- `docs/PROJECT_STATUS.md`, `docs/TASK_QUEUE.md`, `docs/AGENT_HANDOFF.md`, `docs/DEPLOYMENT.md`, `docs/DECISIONS.md`
- Any later work must append actual changed files and results here.

## Last verified pushed and deployed commit
- Baseline `98969f648124fac7eb4dc54e14158451246bf72a`, CI 38608642413 success, deploy 38608765943 success. **This handoff commit was not yet built when the file was authored**; verify its SHA and runs before marking it deployed.

## Executed verification
- GitHub metadata: `main` writable, no open PRs, open issue #39.
- GitHub Actions: the baseline SHA CI and deploy both succeeded.
- Supabase read-only `information_schema`/`pg_proc`/`pg_trigger` checks, project `pcjfahhlozsseqqevimi`: `rentauto.accounts` and `rentauto.trips` exist; `public.trips` / `public.user_roles` do not; old outbox objects and Edge Function absent; production Rentauto account and trip counts both zero.
- No production SQL modifications or test payments performed as part of the schema audit.

## Known problems / access
- DO NOT run historical outbox migration `supabase/migrations/20260930161000_takatak_integration_outbox.sql` on current shared Supabase: incompatible and could replace shared auth trigger.
- Need verified Rentauto-specific event/receiver contract and staged migration. Confirm server-only `TAKATAK_RENTAUTO_SYNC_URL`, `TAKATAK_RENTAUTO_SYNC_CLIENT_ID`, `TAKATAK_RENTAUTO_SYNC_WEBHOOK_SECRET`, `TAKATAK_SYNC_RUNNER_SECRET` without reading or exposing secret values.
- Real SMS, Stripe, GPS operator accounts/settings and test participants are required for LC1 completion.
- Browser-side web fetch of `https://rentauto.ca` was unavailable from one inspection path; use GitHub deploy run SHA check and an independent network probe. Do not overclaim.

## Exact next action
1. Re-read the current `main` SHA and this handoff, then inspect issue #39. Read the live `rentauto.sync_takatak_marketplace_order_trigger` and `public.bootstrap_rentauto_account_authorized_impl` contracts before writing a replacement outbox.
2. Implement a restricted Rentauto-scoped migration and sender, **without touching shared `public.handle_new_user`**. Test schema/permission/idempotency/receiver contract in staging; deploy backend only when verified.
3. Push to `main` through non-force GitHub CAS writes; inspect CI and exact-SHA live deploy, and record final SHA/results in this file.

## Session follow-up: authentication gate repair
- Located a functional mismatch: React `AuthContext` and `ensureProfile` read obsolete `user_roles.user_id`; production uses `rentauto.account_roles.auth_user_id`, with authenticated SELECT restricted by RLS.
- Fixed both lookups, updated typed schema, normalized roles, gated all private routes on Rentauto membership, and refreshed roles after explicit consent. Added `src/lib/rentauto-membership.test.ts`.
- This commit must pass typecheck/test/build and publish to MochaHost. Re-check the exact new commit SHA and update deployment evidence; no live guest/host login was performed.

## Security follow-up: safe OAuth redirect parsing
- Replaced prefix-only redirect checks with WHATWG URL origin validation and explicit backslash/control-character rejection. Added `src/lib/auth-helpers.test.ts` for both safe and malicious return destinations.
- New commit built on `754c7578bb6143fb00a2b965ebaf61605a2ce6dc`; check its new SHA, CI and deployment independently. No credentials or user login were used.

## Privacy disclosure correction (2026-10-14)
- Shared TAKATAK Supabase project metadata confirms `eu-west-1`. Corrected the old inaccurate Canada/US-only infrastructure statement in `src/pages/legal/Privacy.tsx`; updated retention to reflect applicable record-specific rules without a blanket unsupported period. Added `src/test/privacy-disclosure.test.ts`.
- Base commit before this change: `67c7301e6e0b70b43e3343d1812ed470b75448d7`; confirm the new SHA and exact GitHub deploy run independently.

## Direct TAKATAK integration correction
- Verified installed `rentauto.project_trip_to_takatak_marketplace_order` procedure and trigger project non-draft trips into `public.source_marketplace_orders`; account bootstrap already creates explicit source profiles. Updated `docs/TAKATAK_INTEGRATION.md` and `docs/API_REFERENCE.md` to distinguish these live direct projections from the uninstalled outbox. Do not deploy the historical global-trigger migration. Base before this update: `0291737f123bb754dd70c7d381d44db7cd47e961`.

## MochaHost upload-retry recovery
- CI for `67c7301e6e0b70b43e3343d1812ed470b75448d7` succeeded (run 38614477840). Previous `df6aed6362` deployment failed while MochaHost refused SSH exec commands; latest `67c7301e` deployment reached upload but remote transport again failed intermittently.
- Updated `.github/workflows/deploy-mochahost.yml` to retry uploads with bounded backoff, SHA-256 and size readback before activating `CURRENT`. Updated contract test. Check exact new SHA's CI and MochaHost Deploy result, and ensure old artifact wasn't marked live on failure.
- SHA before this fix: `e108e25bf14b33b6fc65292cb956bfa70fc0c1b1`.

## 2026-10-14 FINAL CURRENT-SESSION READBACK

- **Last pushed feature/deployment fix SHA:** `32d615164bf09f0c6778bccb7b6c340fd0f2972b` (`fix(deploy): retry MochaHost transfers with SHA-256 verification`). This handoff update is committed immediately after it; read `git rev-parse HEAD` to identify the self-containing documentation commit without creating an endless self-referential SHA change.
- **CI:** latest feature/fix run **38615508682 succeeded** (Typecheck, parity, changed-file lint, tests, build).
- **Production deploy for the same SHA:** run **38615701658 failed** at "Verify MochaHost remote command access", before upload/activation.
- **Last confirmed deployed production SHA:** `98969f648124fac7eb4dc54e14158451246bf72a`, successful deploy **38608765943**. Do not claim the newer commits are live.
- **Blocker:** GitHub issue [#40](https://github.com/takatakca/rentautoca/issues/40) — MochaHost SSH authenticates the deployment key but rejects execution channels intermittently. New bounded archive-upload retry helps only after SSH exec works. MochaHost operator must restore reliable non-interactive shell access before another deployment attempt.
- **Backend blocker:** issue [#39](https://github.com/takatakca/rentautoca/issues/39). Existing TAKATAK direct account/order projections are installed; un-deployed outbox is incompatible with the live shared schema. No unsafe migration was applied.
- **Files changed in newest code release:** `.github/workflows/deploy-mochahost.yml`, `src/test/mochahost-passenger-deployment.test.ts`, `docs/AGENT_HANDOFF.md`, `docs/TASK_QUEUE.md`, `WORKLOG.md`.
- **Other completed source changes this session:** `src/contexts/AuthContext.tsx`, `src/lib/auth-helpers.ts`, `src/integrations/supabase/types.ts`, `src/components/auth/ProtectedRoute.tsx`, `src/pages/Signup.tsx`, `src/lib/rentauto-membership.ts`, their tests, `src/pages/legal/Privacy.tsx`, new documentation and tests.
- **Verification commands:** GitHub Actions `npm run typecheck`, `npm run qa:edge-sources`, `npx eslint`, `npm run test`, `npm run build` passed for latest fix SHA; read-only Supabase schema/function/RLS introspection passed. Production `/healthz` exact-SHA verification did **not** pass for recent commits.
- **Precise next action:** check issue #40 and restore MochaHost SSH exec permission, then dispatch the *newest* `main` deploy and check `/healthz` revision. While awaiting hosting, address issue #39 only via an additive isolated design verified against existing direct projections; do not run historical `20260930161000_takatak_integration_outbox.sql`. Then conduct LC1 real account/host/trip/Stripe/GPS acceptance.

## 2026-10-15 — Continuation: enforce migration-safety gate
- **Last task completed:** reviewed issue #39/#40 and introduced CI static safety guard against automatic execution of the obsolete shared-auth/outbox migration.
- **Current task:** #39, design additive Rentauto-only event delivery only after current direct TAKATAK projections and receiver are independently verified; #40 deployment SSH remains blocked.
- **Files changed:** `scripts/check-migration-safety.mjs`, `.github/workflows/ci.yml`, five continuity documents, `WORKLOG.md`.
- **Starting SHA:** `c1028a551b06e907cb81e00785d63f63f003dc44`. Resulting commit: consult `git rev-parse HEAD` (self-reference intentionally avoided).
- **Checks:** remote GitHub `main`, open PR/issues, CI and deployment history inspected. New check will run as a dedicated CI step. No production schema changes or function deployments made.
- **Known blockers:** issue #40 SSH remote exec rejects commands despite authentication; issue #39 historical migration touches nonexistent schema and shared identity trigger. TAKATAK direct account/order projections already exist.
- **Deployment status:** newest inspected `c1028a551b06e907cb81e00785d63f63f003dc44` passed CI run 38616084653 but failed MochaHost deploy run 38616259955; last confirmed deployed SHA `98969f648124fac7eb4dc54e14158451246bf72a`.
- **Access required:** MochaHost operator to restore non-interactive SSH exec; real host/guest, Stripe, SMS and GPS acceptance credentials/configuration for LC1 (never include secrets in repository).
- **Exact next action:** verify this commit's CI guard; after host SSH repair, deploy the newest validated main SHA and compare /healthz revision. Reconcile direct TAKATAK projection versus network outbox before any new migration; perform staged permission/idempotency checks.

## 2026-10-15 — TAKATAK transport security implementation
- **Last completed task:** Compared the Rentauto sender with the actual TAKATAK receiver in `takatakca/takatak-v1`: `src/app/api/integrations/rentauto/events/route.ts`, `src/lib/integrations/rentauto/signature.ts`, and parser/apply-event. Implemented HTTPS + exact route + TAKATAK-origin validation (optional explicit staging origin), fail-closed redirects, and explicit `accepted:true` acknowledgement checking; added unit tests.
- **Current task:** #39 remains: receiver is in master source but shared Supabase outbox table/RPC are missing, production function not deployed, credentials/scheduler unverified. Keep direct TAKATAK projections intact and prevent duplicate writes.
- **Files changed:** `supabase/functions/_shared/takatak-sync-transport.ts`, `supabase/functions/takatak-sync-outbox/index.ts`, `src/test/takatak-sync-transport.test.ts`, `docs/TAKATAK_INTEGRATION.md`, all five continuity docs, `WORKLOG.md`.
- **Previous verified deployed SHA:** `a0e2d5f2f5634d6f967f08d489e603b1934c1c7d` (CI [38841266269](https://github.com/takatakca/rentautoca/actions/runs/38841266269), MochaHost [38841341501](https://github.com/takatakca/rentautoca/actions/runs/38841341501) SUCCESS with exact SHA). This task's new SHA is the current `main` head after commit; do not write a self-referential SHA.
- **Verification:** read-only Supabase function/schema query for current direct projections; reviewed TAKATAK Next.js HMAC receiver; Vitest unit cases added; verify CI results after push.
- **Known blockers:** #39 outbox transport not live, database migrations incompatible, unknown server-side secrets and separate target runtime; #40 SSH intermittent but most recent deployment succeeded; LC1 account/host/booking/Stripe/GPS acceptance incomplete.
- **Access needed:** staging database/approved endpoint and server-only HMAC secrets for a controlled roll-out; no secrets are written to repository. No production SQL performed here.
- **Deployment status:** backend sender changes **source only**, never assume deployed to shared Supabase. Frontend MochaHost may deploy the commit automatically after CI; verify run success and live revision independently.
- **Exact next action:** check this commit CI and MochaHost SHA; create a separate Rentauto-scoped outbox migration without global public auth trigger changes and verify staging RLS/idempotency. Do not enable any second sync until the TAKATAK receiver's data store is confirmed distinct from already-synced direct projections.

## 2026-10-15 — Staged Rentauto outbox; backend activation deliberately withheld
- **Last completed:** drafted Rentauto-only SQL at `supabase/staged/rentauto-takatak-outbox-v1.sql`, with a default-off gate, no global auth triggers, RLS, service-role RPCs, retriable outbox and lease-token fencing; updated sender and added contract tests.
- **Current:** #39 backend outbox rollout remains blocked by incompatible historical migrations, lack of isolated schema/permissions/replay tests, unknown production receiver settings and potential master projection duplication. LC1 real account/host/checkout/GPS signoff incomplete.
- **Changed files:** staged SQL, `supabase/functions/takatak-sync-outbox/index.ts`, `src/test/takatak-outbox-staging.test.ts`, five continuity docs and `WORKLOG.md`.
- **Last confirmed pushed and deployed prior to these edits:** `548df074d96ade2b5756c431fa597a69d533db56`, CI 38843662002 SUCCESS, MochaHost 38843721183 SUCCESS with exact live SHA. New commit SHA is current main HEAD; don't create a self-referential SHA.
- **Verification:** GitHub latest branch and run readback, Supabase live schema / master function read-only inspection, source comparison against TAKATAK HMAC receiver. New contract checks to be run by CI; no PostgreSQL execution of staged DDL yet.
- **Known blockers:** issue #39, intermittent SSH #40 (last two runs passed), Stripe/SMS/GPS production acceptance; server secrets not inspected, staged SQL not applied and Edge sender not deployed.
- **Environment and access:** MochaHost cPanel Passenger frontend; separate shared Supabase TAKATAK backend. Isolated staging/approved sender secrets needed to execute and verify migrations and integration.
- **Exact next action:** verify CI and exact SHA deployment; run staged SQL in disposable PostgreSQL, test service-only grants/lease fencing/event order, verify TAKATAK Prisma datastore separation from shared Supabase direct projections, then create reviewed CLI-generated migration and deploy sender with secrets and explicit approval. Do not enable sync default flag prematurely.
