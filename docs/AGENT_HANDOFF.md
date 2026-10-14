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
