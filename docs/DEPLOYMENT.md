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
