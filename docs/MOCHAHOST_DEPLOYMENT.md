# Deploying Rentauto to MochaHost (cPanel Node.js)

Rentauto is a Vite + React SPA served in production by a small Express
server (`server.cjs`) so React Router deep links survive a refresh.
The canonical short version lives at `/DEPLOY_MOCHAHOST.md`; this file
expands on it with troubleshooting.

## 1. cPanel Node.js app settings

In cPanel → **Setup Node.js App**:

| Field | Value |
|---|---|
| Node.js version | 18.x or 20.x |
| Application mode | Production |
| Application root | the folder you uploaded to |
| Application URL | your domain or subdomain |
| Application startup file | `server.cjs` |

## 2. Environment variables

Add these in the cPanel Node app's **Environment variables** panel:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`
- `VITE_APP_URL` — canonical URL (e.g. `https://rentauto.ca`)

⚠️ Do **not** put server secrets here. `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, and
`TRACKING_PROVIDER_SECRET` live **only** in Supabase Edge Function secrets.

## 3. Install + build + start

```bash
npm install
npm run build
npm start
```

`npm run build` produces `dist/`. `npm start` runs `node server.cjs`, which
serves `dist/` and falls back any unknown route to `dist/index.html`
(SPA fallback so React Router deep links work).

## 4. Verifying

Browse and refresh each route — none should 404:

- `/`, `/explore`, `/cars/<id>`, `/trips`, `/messages`, `/profile`,
  `/host`, `/admin`, `/admin/launch-checklist`

## 5. Troubleshooting

| Symptom | Likely cause |
|---|---|
| 502 / app won't start | Wrong startup file; must be `server.cjs` |
| Routes 404 on refresh | `server.cjs` not serving SPA fallback (check `app.get('*', ...)`) |
| Stripe success URL 404 | `VITE_APP_URL` mismatch with deployed domain |
| Auth callback fails | Add deployed URL to Supabase Auth → URL Configuration → Site URL + Redirect URLs |
| Blank page | Build did not run; `dist/` missing |
