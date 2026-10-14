# MochaHost operating guide — Rentauto.ca

This guide describes the **existing immutable GitHub Actions production workflow**, not a manual cPanel build.

Source of truth: [DEPLOY_MOCHAHOST.md](../DEPLOY_MOCHAHOST.md) and [deployment workflow](../.github/workflows/deploy-mochahost.yml).

## Runtime topology

- Domain: `https://rentauto.ca`
- cPanel account: `bolonca`
- Node application root: `/home/bolonca/rentauto_node` (configurable via `MOCHAHOST_APP_PATH`)
- Passenger startup: installed `app.js`; it reads `CURRENT` and serves `releases/<sha>/dist`
- GitHub Actions builds off-server with Node 22, uploads the immutable release and touches `tmp/restart.txt`
- The domain's `.htaccess` Passenger directives are maintained by the deploy workflow
- `server.cjs` is an optional standalone server for local deployments, **not** the deployed Passenger entrypoint

## Initial cPanel settings

Create the Node application in Production mode with app root `rentauto_node` and URL `rentauto.ca`. Preserve the installed release-pointer `app.js` and do not overwrite the managed `CURRENT` / `PREVIOUS` files or Passenger mapping by uploading a new `dist` manually.

Set the GitHub Actions SSH secret/variable names described in the root deployment guide. Public TAKATAK Supabase/Vite settings are compiled in GitHub Actions; they cannot be changed by setting cPanel runtime environment variables after the Vite build. Stripe and Supabase service-role keys must remain server-only in backend secret storage.

## Safe diagnostics

```bash
curl -fsS https://rentauto.ca/healthz
curl -fsS https://rentauto.ca/revision.txt
curl -I https://rentauto.ca/
curl -I https://rentauto.ca/explore
```

Expected: public routes return HTTP 200, `/healthz` returns JSON with `ok: true` and the deployed commit `revision`. Only the deployed SHA proves which GitHub revision is serving.

In the cPanel File Manager, inspect `rentauto_node/CURRENT`, `rentauto_node/PREVIOUS`, `rentauto_node/releases/`, `rentauto_node/tmp/restart.txt`, and the `rentauto.ca/.htaccess` Passenger block. Do not delete the active release. Review GitHub workflow logs and the cPanel Node app logs before attempting any manual recovery.

## Troubleshooting

| Symptom | Next investigation |
| --- | --- |
| 403 Forbidden | Passenger binding for the domain; the deploy workflow's repair step |
| 502 / startup error | Installed `app.js`, Node interpreter / nodevenv, and `CURRENT` target |
| SPA deep link 404 | Passenger route/SPA fallback; domain mapping to app root |
| Git SHA not current | GitHub CI/deploy outcome, `CURRENT`, Passenger restart, caching |
| Blank page | Deployed `dist/index.html`, JS asset requests, browser console |
| Google login or phone OTP fails | Shared TAKATAK Supabase redirect URLs and SMS provider |
| Stripe or vehicle quote fails | Supabase Edge Functions and server secrets, not a frontend-only redeploy |

The frontend deployment must not be presented as end-to-end launch approval. Follow `docs/LC1_RUNBOOK.md` for separate real host, guest, booking, payment, check-in, tracking, checkout and refund checks.
