# RENTAUTO.CA — PRIORITY TASK QUEUE

## 2026-11-07 — Sequential release checkpoint (current)

Signature: Codex — ChatGPT Work.

- BEFORE: claimed `codex/sequential-release-20261107` from main `0f451af2743c0bad5b2798c75a7694a1b8d90b1a`; read AGENTS, continuity, issues #39/#40/#41 and PR #42. Historical KLEAN note merged by ancestry, not treated as current hosting proof.
- Verified production: DNS apex/www is `209.145.49.63`; existing Coolify application `rcsnisdtwllynxnoce6cehll` (id 24, controller on VPS2, actual destination VPS1), Nixpacks, `node server.cjs`, port 3000. Running image is the baseline main SHA; public HTML SHA-256 `d84c6ef912dc843ca42d0c13276ce060e6855b69047d60ad9493e6a97aa011ec` matches `/app/dist/index.html`. `/healthz` returns plain `ok`; `/revision.txt` is missing. No persistent container mounts. Configured shared Supabase hostname matches `pcjfahhlozsseqqevimi.supabase.co`.
- DURING: production build now stamps `dist/revision.txt` from SOURCE_COMMIT, then GITHUB_SHA, then git HEAD; malformed supplied revisions fail. Explicit revision route precedes long-lived static caching and returns no-store even when missing. Actual HTTP test covers success, missing revision and unchanged health response. Enable Coolify Include Source Commit in Build before deployment.
- Retire automatic MochaHost writes: legacy workflow retained for an explicitly selected manual rollback (`confirm_mochahost=true` and repository variable `RENTAUTO_DEPLOY_TARGET=mochahost`); no CI-completion trigger. This does not migrate DNS or alter the old host. Production remains the existing Coolify target.
- Lockfile reconciliation: existing package.json declared AI SDK/react-markdown packages absent from the lock. npm install filled 94 missing transitive entries and resolved use-sync-external-store 1.5.0 to 1.7.0; no package.json version changes. CI and deployment use npm ci with the committed lock and existing legacy-peer-deps setting. Exact candidate tests/build and both isolated PostgreSQL CI jobs must pass before merge/deploy.
- Branch reconciliation: historical host/guest/driver, booking, cancellation, reviews, payouts, support, tracking and identity branches have their feature files or equivalent consolidated commits in newer main. Do not merge old copies of App/types/Stripe handlers back over current source. Five fully patch-equivalent branches require no write. Old hosting diagnostic branches are not enabled; seo-legal-kit remains a separate unreviewed integration. Preserve all refs.
- Files changed: package.json/package-lock.json, server.cjs, scripts/write-release.mjs, release provenance tests, both workflow install commands, legacy workflow trigger, WORKLOG, historical note preface, and all five continuity files.
- Local verification completed: Node 22 frozen npm ci, typecheck, edge-source parity (24 canonical functions), migration guard, 102 tests / 15 files, production build, full lint (0 errors, 11 existing warnings). GitHub exact-candidate PostgreSQL jobs and main deployment receipt still pending.
- AFTER source preparation: validation and merge pending; this checkpoint does not certify the new build live. Exact SHA/run/container/public revision receipt will be posted on the release PR and #40 after checks. Rollback image must be retained first. No DB migration, Edge Function, secret, Stripe/SMS/GPS or real customer operation is included.
- Blockers retained: #39 second HTTP writer is disabled; shared direct projections remain canonical. Do not apply the obsolete global-auth/outbox migration. #41 LC1 real host/guest/payment/refund/return/GPS sign-off remains incomplete. Old MochaHost #40 errors are historical and not the active hosting diagnosis.
- Exact next action: run frozen dependency install, typecheck, edge parity, migration safety, tests/lint/build, then green candidate and main CI; deploy the exact main through the existing Coolify target and verify uncached public revision, runtime hashes and UI. Publish signed AFTER receipt and proceed to the next repository.

Earlier entries below are historical; this checkpoint supersedes their hosting assumptions.

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

## 2026-10-15 follow-up from failing real SQL smoke
- [x] Fix PL/pgSQL function opener flagged by disposable PostgreSQL CI and add automated delimiter regression.
- [ ] Continue isolating SQL syntax/permissions errors through real CI PostgreSQL until all checks pass; backend still staging only.

## 2026-10-16 direct projection milestone
- [x] Reconcile deployed TAKATAK V1 Prisma migrations with Rentauto shared Supabase database and active direct sync trigger.
- [x] Add executable disposable PostgreSQL direct projection regression job for draft, order, payment/refund, idempotency and two customers.
- [ ] Check new SQL job, CI and live MochaHost SHA. #39 requires architecture revision to avoid redundant HTTP sync.
- [ ] LC1 actual host/guest/Stripe/SMS/GPS verification remains open.

## 2026-10-16 fail-closed transport gate
- [x] Add explicit server-only receiver datastore separation confirmation to undeployed outbox sender; test default-deny and exact opt-in.
- [ ] Verify fresh CI and exact live web SHA; maintain canonical direct projection as TAKATAK's database authority.
- [ ] Actual host/guest, SMS, Stripe and GPS LC1 acceptance remains outstanding; avoid enabling redundant network writer.

## 2026-10-16 CI lint correctness
[x] Fix GitHub changed-file lint false empty diff on main. [ ] Verify new CI/test and MochaHost SHA; continue LC1 real acceptance.

## 2026-10-16 lint remediation
- [x] Fix the first set of historical ESLint issues using real TS types and non-destructive source changes.
- [ ] Confirm CI lint/build, then finish remaining typed concierge/AI/auto-generated integration lint debt without suppressing security checks.
- [ ] LC1 real accounts, bookings, payments and tracking acceptance remains.

## 2026-10-16 lint cleanup phase 2
- [x] Replace remaining six historical explicit any/const lint issues (concierge result, AI gateway, preview session broker).
- [ ] Confirm actual full lint has zero errors and typecheck/build succeed; promote full lint to a blocking gate when verified.

## 2026-10-16 code quality gate
- [x] Resolve all 20 pre-existing ESLint errors, verify full lint exit 0 despite 11 nonblocking Fast Refresh warnings.
- [x] Enforce full `npm run lint` in GitHub Actions, add regression check against continue-on-error bypass.
- [ ] Verify new CI and deploy; remaining React warning cleanups are optional quality work; LC1 provider/customer real acceptance is still outstanding.
