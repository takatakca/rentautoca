# Deploying Rentauto to MochaHost (cPanel Node.js)

This app is a Vite + React SPA. In production it is served by a small Express
server (`server.cjs`) so React Router deep links work after a refresh.

## 1. cPanel Node.js app settings

In cPanel → **Setup Node.js App**:

| Field                    | Value                          |
| ------------------------ | ------------------------------ |
| Node.js version          | 18.x or 20.x                   |
| Application mode         | Production                     |
| Application root         | the folder you uploaded to     |
| Application URL          | your domain or subdomain       |
| Application startup file | `server.cjs`                   |

## 2. Environment variables

Add these in the cPanel Node app **Environment variables** panel
(see `.env.example` for the full list):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`
- `VITE_APP_URL`

Do **not** put any secret keys here. Secrets (Stripe secret key, Supabase
service role, etc.) live only in Supabase Edge Function secrets.

## 3. Install + build + start

From the cPanel Node app terminal (or via "Run NPM Install"):

```bash
npm install
npm run build
npm start
```

`npm run build` produces `dist/`. `npm start` runs `node server.cjs`, which
serves `dist/` and falls back any unknown route to `dist/index.html`.

## 4. Verifying

After start, browse and refresh each route directly — none should 404:

- `/`
- `/explore`
- `/cars/<id>`
- `/trips`
- `/messages`
- `/profile`
- `/host`

## 5. Local production smoke test

```bash
npm install
npm run build
npm start
# open http://localhost:3000
```
