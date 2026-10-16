# RENTAUTO.CA — DEPLOYMENT STATE

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
