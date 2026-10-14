# RENTAUTO.CA

Peer-to-peer vehicle rental marketplace for Canada, integrated with GROUPE TAKATAK identity services while keeping Rentauto rental operations, trips, vehicles, payments, tracking and host workflows independently scoped.

## Production

- Public site: `https://rentauto.ca`
- Source of truth: this GitHub repository
- Production branch: `main`
- Frontend: React + TypeScript + Vite
- Production runtime: cPanel Passenger on MochaHost
- Shared identity/backend: TAKATAK Supabase
- Payments and host payouts: Stripe / Stripe Connect

## Local development

Requirements: Node.js 22 and npm.

```bash
npm install --legacy-peer-deps
npm run dev
```

Before opening a pull request, run:

```bash
npm run typecheck
npm run qa:edge-sources
npm test
npm run build
npm run lint
```

## Deployment model

Production is deployed automatically from validated `main` commits.

1. **Rentauto CI** runs typecheck, Edge Function source parity, lint, tests and the production build.
2. A successful main CI run triggers **Deploy rentauto.ca to MochaHost**.
3. The deploy workflow creates a SHA-stamped immutable artifact and preserves it in GitHub Actions.
4. The artifact is uploaded over SSH to the MochaHost application root.
5. Passenger binding for `rentauto.ca` is verified/self-healed before activation.
6. The release is extracted to `releases/<git-sha>`.
7. `CURRENT` is atomically changed to the new SHA and Passenger is restarted through `tmp/restart.txt`.
8. Deployment succeeds only when the live `/healthz` response reports `ok=true` and the exact expected Git SHA.
9. If verification fails, `CURRENT` is restored to the previous release.

Do **not** run production frontend builds on MochaHost. GitHub Actions builds the artifact off-server.

## Architecture boundaries

RENTAUTO is an independent application under GROUPE TAKATAK.

- TAKATAK is the master identity authority.
- A TAKATAK login does not silently opt a person into RENTAUTO; explicit Rentauto authorization/consent is required.
- Rentauto owns rental-domain operational truth: vehicles, availability, trips, booking holds, tracking, incidents and host operations.
- Pricing, taxes, booking holds and payment state are server-authoritative.
- Stripe webhooks are idempotent and transactional.
- Browser clients never receive service-role, Stripe secret or tracking-provider credentials.

## Supabase Edge Functions

Canonical production function names use the `rentauto-*` prefix. See `docs/EDGE_FUNCTIONS.md` for the current function inventory and authentication rules.

## Important production files

- `.github/workflows/ci.yml` — validation pipeline
- `.github/workflows/deploy-mochahost.yml` — immutable production deployment
- `supabase/config.toml` — Edge Function JWT policy
- `supabase/migrations/` — database authority and security changes
- `docs/EDGE_FUNCTIONS.md` — Edge Function runtime guide
- `docs/MOCHAHOST_DEPLOYMENT.md` — hosting/deployment notes
