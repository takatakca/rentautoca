# RENTAUTO.CA — DEPLOYMENT STATE

## 2026-11-07 — Sequential release checkpoint (current)

Signature: Codex — ChatGPT Work.

- BEFORE: claimed `codex/sequential-release-20261107` from main `0f451af2743c0bad5b2798c75a7694a1b8d90b1a`; read AGENTS, continuity, issues #39/#40/#41 and PR #42. Historical KLEAN note merged by ancestry, not treated as current hosting proof.
- Verified production: DNS apex/www is `209.145.49.63`; existing Coolify application `rcsnisdtwllynxnoce6cehll` (id 24, controller on VPS2, actual destination VPS1), Nixpacks, `node server.cjs`, port 3000. Running image is the baseline main SHA; public HTML SHA-256 `d84c6ef912dc843ca42d0c13276ce060e6855b69047d60ad9493e6a97aa011ec` matches `/app/dist/index.html`. `/healthz` returns plain `ok`; `/revision.txt` is missing. No persistent container mounts. Configured shared Supabase hostname matches `pcjfahhlozsseqqevimi.supabase.co`.
- DURING: production build now stamps `dist/revision.txt` from SOURCE_COMMIT, then GITHUB_SHA, then git HEAD; malformed supplied revisions fail. Explicit revision route precedes long-lived static caching and returns no-store even when missing. Actual HTTP test covers success, missing revision and unchanged health response. Enable Coolify Include Source Commit in Build before deployment.
- Retire automatic MochaHost writes: legacy workflow retained for an explicitly selected manual rollback (`confirm_mochahost=true` and repository variable `RENTAUTO_DEPLOY_TARGET=mochahost`); no CI-completion trigger. This does not migrate DNS or alter the old host. Production remains the existing Coolify target.
- Lockfile reconciliation: existing package.json declared AI SDK/react-markdown packages absent from the lock. npm install filled 94 missing transitive entries and resolved use-sync-external-store 1.5.0 to 1.7.0; no package.json version changes. CI and deployment use npm ci with the committed lock and existing legacy-peer-deps setting. Exact candidate tests/build and both isolated PostgreSQL CI jobs must pass before merge/deploy.
- Branch reconciliation: historical host/guest/driver, booking, cancellation, reviews, payouts, support, tracking and identity branches have their feature files or equivalent consolidated commits in newer main. Do not merge old copies of App/types/Stripe handlers back over current source. Four fully patch-equivalent branches require no write. The fifth previously grouped reference, fix/mochahost-passenger-healthcheck, is obsolete rather than equivalent: it would restore push-triggered Passenger deployment and remove later guards. Old hosting diagnostic branches are not enabled; seo-legal-kit remains a separate unreviewed integration. Preserve all refs.
- Files changed: package.json/package-lock.json, server.cjs, scripts/write-release.mjs, release provenance tests, both workflow install commands, legacy workflow trigger, WORKLOG, historical note preface, and all five continuity files.
- Local verification completed: Node 22 frozen npm ci, typecheck, edge-source parity (24 canonical functions), migration guard, 102 tests / 15 files, production build, full lint (0 errors, 11 existing warnings). GitHub exact-candidate PostgreSQL jobs and main deployment receipt still pending.
- AFTER source integration: PR #43 merged as 3c7217a34c04c674261a448ddb610088e826d6da; candidate CI 42364852016/42364849109 and main CI 42364965047 succeeded including 102 tests and both PostgreSQL jobs. The exact production result is tracked in the signed PR receipt, not inferred from the merge. Exact SHA/run/container/public revision receipt will be posted on the release PR and #40 after checks. Rollback image must be retained first. No DB migration, Edge Function, secret, Stripe/SMS/GPS or real customer operation is included.
- Blockers retained: #39 second HTTP writer is disabled; shared direct projections remain canonical. Do not apply the obsolete global-auth/outbox migration. #41 LC1 real host/guest/payment/refund/return/GPS sign-off remains incomplete. Old MochaHost #40 errors are historical and not the active hosting diagnosis.
- Exact next action: run frozen dependency install, typecheck, edge parity, migration safety, tests/lint/build, then green candidate and main CI; deploy the exact main through the existing Coolify target and verify uncached public revision, runtime hashes and UI. Publish signed AFTER receipt and proceed to the next repository.

Earlier entries below are historical; this checkpoint supersedes their hosting assumptions.


## Source and topology
- Repository `takatakca/rentautoca`, branch `main`.
- GitHub workflow: `.github/workflows/ci.yml` validates code.
- After successful main CI, `.github/workflows/deploy-mochahost.yml` builds the immutable frontend, stamps a git SHA, uploads over SSH, and atomically switches `CURRENT`.
- Hosting: MochaHost cPanel / Passenger, application root `/home/bolonca/rentauto_node`, startup script **installed** `app.js` resolving the `CURRENT` release. Do not build on shared hosting or replace the installed startup with repo `server.cjs`.
- Domain `https://rentauto.ca`. The deploy job demands matching `/healthz` `ok:true` and `revision` and rolls back on failure.

## Last verified deployment before this handoff update
- Commit: `98969f648124fac7eb4dc54e14158451246bf72a`.
- CI run: https://github.com/takatakca/rentautoca/actions/runs/38608642413 — success.
- Deploy run: https://github.com/takatakca/rentautoca/actions/runs/38608765943 — success.
- **Later commits must be checked separately**; the baseline success does not automatically prove a new revision live.

## Backend separately deployed
- Shared TAKATAK Supabase project `pcjfahhlozsseqqevimi` has Rentauto Edge Functions active; no automated database migration deployment is configured by the MochaHost frontend workflow.
- The outbox function and its DB authority are absent in the production project; see issue #39.
- Backend schema updates and function releases must be validated independently, with least-privilege grants and deployment readback.

## Read-only verification
```bash
curl -fsS https://rentauto.ca/healthz
curl -fsS https://rentauto.ca/revision.txt
curl -I https://rentauto.ca/
```
Compare `/healthz` revision to a successful **specific** GitHub deployment run. Inspect run steps, logs, `CURRENT`, `PREVIOUS` for mismatch.

See `DEPLOY_MOCHAHOST.md` and `docs/MOCHAHOST_DEPLOYMENT.md` for details.

## 2026-10-14 incident update

- Successful release baseline: `98969f648124fac7eb4dc54e14158451246bf72a`, GitHub Deploy run `38608765943`.
- Latest code commit at incident checkpoint: `32d615164bf09f0c6778bccb7b6c340fd0f2972b`, GitHub CI `38615508682` **success**.
- Its GitHub Deploy run `38615701658` **failure**: `Verify MochaHost remote command access` (SSH exec channel refused, before activation).
- Production live revision for later commits **not confirmed**. See GitHub issue #40 for SSH operator diagnostics and exact resume procedure.

## 2026-10-15 read-back
- Starting main SHA: `c1028a551b06e907cb81e00785d63f63f003dc44`.
- CI run 38616084653: success. Deploy run 38616259955: failure. Last confirmed active deployment SHA still `98969f648124fac7eb4dc54e14158451246bf72a`.
- The new CI migration guard is validation-only; it does not deploy Supabase migrations or change MochaHost settings. Wait for a fresh successful deployment run and exact live SHA read-back.

## 2026-10-15 release checkpoint
- Verified exact-SHA frontend deployment `a0e2d5f2f5634d6f967f08d489e603b1934c1c7d`: [CI 38841266269](https://github.com/takatakca/rentautoca/actions/runs/38841266269) and [MochaHost 38841341501](https://github.com/takatakca/rentautoca/actions/runs/38841341501) succeeded, including live revision verification. Previous #40 SSH refusal is intermittent; latest success is not proof of permanent host repair.
- Current change alters source for `takatak-sync-outbox` Edge Function but it is NOT deployed. GitHub frontend deployments cannot publish it. This change does not modify shared production data or secrets.
- New setting `TAKATAK_RENTAUTO_SYNC_ALLOWED_ORIGIN` optional for controlled non-`*.takatak.ca` staging; never set to an untrusted endpoint. Receiver must be HTTPS at `/api/integrations/rentauto/events`.

## 2026-10-15 staging SQL release gate
- `supabase/staged/rentauto-takatak-outbox-v1.sql` is deliberately outside auto-applied migrations. SQL and new Edge RPC code have NOT run on shared Supabase. Gate starts `enabled=false`; promotion requires isolated staging validation and a reviewed migration generated with the Supabase CLI.
- Last confirmed deployed frontend SHA: `548df074d96ade2b5756c431fa597a69d533db56`, successful CI 38843662002 and MochaHost 38843721183 with exact revision. Confirm subsequent runs independently.

## 2026-10-15 disposable PostgreSQL validation
- GitHub Actions `outbox-sql-smoke` runs staged SQL against disposable Postgres 16 `rentauto_outbox_ci`, **without production secrets**. Script refuses non-CI database names. Frontend deploy does not enable the Supabase outbox.
- Latest confirmed live frontend before this change: `b297e6aebc6f50109d5ff9f8d8e12d621c068c3f` (run 38844285977).

## 2026-10-15 staged outbox operational control
- The reviewed staging-only SQL has a fail-closed outbox claim gate and master-identity-compatible source profile lookup. No production Supabase writes; the latest confirmed frontend deploy before these edits was `17612acb30f8a77608baebf165cf65cb713607f5` in run 38844631301.

## 2026-10-15 SQL test failure/repair
- CI run 38844815420 blocked frontend release after real PostgreSQL identified `AS $` typo. New commit corrects this; no production rollout was made for failing SHA. Last confirmed live remains `17612acb30f8a77608baebf165cf65cb713607f5` (run 38844631301).

## 2026-10-16 master direct projection
- TAKATAK V1 Prisma migration rows and Rentauto tables coexist in the same live Supabase PostgreSQL instance. A second HTTP event sender remains UNDEPLOYED. New CI job `direct-projection-sql-smoke` uses only disposable PostgreSQL database `rentauto_projection_ci` and the actual versioned direct SQL from `supabase/migrations/20261001041000_rentauto_takatak_order_projection.sql`.
- Last confirmed deployed frontend before this change: `fc668ee922d808bc5aec047c3b1f4776c97252ac`, GitHub run 38845009659. Check new CI/revision before declaring a new release.

## 2026-10-16 duplicate-writer deployment safety
- The HTTP `takatak-sync-outbox` code is **not installed**. It refuses requests (after runner authentication) unless `TAKATAK_RENTAUTO_SYNC_INDEPENDENT_STORE_CONFIRMED=true` is explicitly present as a server-only setting. This flag is forbidden as a Vite public variable and must only be set with verified independent master datastore and accepted deduplication/consent tests.
- In the current same-database architecture, **do not set it**. Direct in-DB projections already provide master authority. Frontend deploy does not activate a Supabase Edge Function.
- Last verified web release before this change: `3a39c9b873ff0e6bf731439293bf4e4acc6e5d99`, run 38943130066.

## 2026-10-16 CI lint correctness
Main push ESLint gate now compares github.event.before with HEAD, not origin/main...HEAD. PRs use base SHA. Last confirmed release before update: 48bea913cabfac42bcfb2d04bdb80aed41e60933 (deploy 38943517693).

## 2026-10-16 TypeScript debt cleanup
- Historical lint errors found in the optional full lint report; selected fixes are behind changed-file ESLint, TS typecheck, tests, real Postgres CI and immutable SHA deployment. Last confirmed live SHA before changes: `fd0dbd061aa09ded90d6764f985f7f42eb5af9e9`, run 38943989916.

## 2026-10-16 lint remediation phase 2
- No schema or Edge Function deployment in this change. Frontend changes ship only after ESLint on actual changed files, TypeScript, Vitest, both disposable PostgreSQL tests and exact-SHA MochaHost health. Last confirmed live SHA: `5d172495fecffcd68a06b2e6641f447fecfebadf`, run 38944537116.

## 2026-10-16 full lint now mandatory
- CI no longer uses `continue-on-error` on the full ESLint step, so any future lint errors block downstream deployment. This was enabled only after the previous run reported 0 errors (11 warnings) and deployed SHA `1a7b5098adbcab875bd41bc68d07ccf5f92ea71f` successfully via MochaHost run 38944889082.
