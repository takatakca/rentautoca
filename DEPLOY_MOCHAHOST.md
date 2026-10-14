# RENTAUTO.CA — production deployment (MochaHost Passenger)

**Production URL:** https://rentauto.ca  
**Repository:** https://github.com/takatakca/rentautoca  
**Production branch:** `main`  
**Current delivery authority:** `.github/workflows/deploy-mochahost.yml`

## Automatic path: GitHub → live

1. Push or merge a change into `main`.
2. GitHub Actions **Rentauto CI** validates TypeScript, Edge source parity, tests and build.
3. Only a successful main CI run triggers **Deploy rentauto.ca to MochaHost**.
4. GitHub Actions builds the Vite assets with Node.js 22 and the shared TAKATAK public Supabase settings. No build runs on the shared hosting server.
5. The workflow archives the assets with a Git commit SHA, preserves the artifact in GitHub Actions for 14 days and uploads it over SSH.
6. MochaHost stores the release under `releases/<sha>/dist` in `/home/bolonca/rentauto_node`; the `CURRENT` text file selects the active release.
7. cPanel Passenger uses the **installed `app.js` release-pointer runtime**, not the repository's standalone `server.cjs`. The workflow repairs the domain's Passenger mapping if necessary and restarts with `tmp/restart.txt`.
8. Deployment is successful only if `https://rentauto.ca/healthz` returns HTTP 200, `ok: true`, and the exact expected Git SHA. If activation fails, the workflow restores the previous `CURRENT` release.

**Do not run `npm install`, `npm run build` or `npm start` on MochaHost for this production workflow.** The repository `server.cjs` is a standalone/local alternative, not the installed production startup file.

## GitHub configuration

GitHub repository secrets: `MOCHAHOST_HOST`, `MOCHAHOST_USER`, `MOCHAHOST_PORT` (optional, defaults to 22), `MOCHAHOST_SSH_KEY`. The workflow uses repository variable `MOCHAHOST_APP_PATH` (defaults to `/home/bolonca/rentauto_node`).

The browser-safe Vite variables are `VITE_TAKATAK_SUPABASE_URL`, `VITE_TAKATAK_SUPABASE_PUBLISHABLE_KEY`, `VITE_TAKATAK_SUPABASE_PROJECT_ID`, `VITE_APP_URL=https://rentauto.ca`. The workflow currently supplies these at build time. Never add service-role credentials, Stripe secret keys, provider secrets, or SMS provider credentials to a `VITE_*` variable.

Supabase migrations, deployed Edge Functions, SMS configuration, Stripe webhooks and provider secrets are **separate backend release responsibilities**; a successful frontend deploy does not prove these backend services were updated.

## Read-only production verification

```bash
curl -fsS https://rentauto.ca/healthz
curl -fsS https://rentauto.ca/revision.txt
curl -I https://rentauto.ca/
curl -I https://rentauto.ca/explore
curl -I https://rentauto.ca/privacy
```

Compare the reported health revision against the exact `main` SHA deployed by the workflow. Review the CI and Deploy workflow run conclusions. Also inspect private routes, authentication, Edge Functions, booking and payments during launch testing; HTTP 200 alone does not certify the customer journey.

## Production failure handling

- **CI install fails / `npm ETARGET`:** inspect the named package and lockfile resolution. A just-published transitive package can be missing temporarily from npm registry replicas. Re-run the failed job only after the version is confirmed available. If persistent, update and pin the dependency graph/lockfile instead of disabling CI.
- **SSH exec rejected:** deployment stops before activating a new release. Check key, user, remote command permissions, or host restrictions.
- **403 or stale site:** inspect Passenger domain binding at `$HOME/rentauto.ca/.htaccess`, startup `app.js`, `CURRENT`, and the deployment logs.
- **Health revision mismatch:** activation must roll back the `CURRENT` pointer; diagnose the Passenger process and cache before a new attempt.
- **Auth, Stripe, tracking, or Edge error:** verify the backend secrets and deployed Supabase functions independently; never put private keys in frontend config.
