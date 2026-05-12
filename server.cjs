/**
 * Production Node server for MochaHost / cPanel Node.js hosting.
 *
 * - Serves the Vite production build from /dist
 * - Falls back any unknown route to dist/index.html so React Router (BrowserRouter)
 *   handles deep links like /cars/:id, /trips, /favorites, etc.
 * - Listens on process.env.PORT (cPanel/MochaHost injects this) or 3000 locally.
 *
 * Run:
 *   npm install
 *   npm run build
 *   npm start
 */

const path = require("path");
const fs = require("fs");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;
const DIST_DIR = path.join(__dirname, "dist");
const INDEX_HTML = path.join(DIST_DIR, "index.html");

if (!fs.existsSync(INDEX_HTML)) {
  console.error(
    "[server] dist/index.html not found. Run `npm run build` before starting."
  );
  process.exit(1);
}

// Static assets with long cache for hashed files
app.use(
  express.static(DIST_DIR, {
    index: false,
    maxAge: "1y",
    setHeaders: (res, filePath) => {
      if (filePath.endsWith("index.html")) {
        res.setHeader("Cache-Control", "no-cache");
      }
    },
  })
);

// Lightweight health check
app.get("/healthz", (_req, res) => res.status(200).send("ok"));

// SPA fallback — any non-asset GET returns index.html
app.get(/.*/, (_req, res) => {
  res.setHeader("Cache-Control", "no-cache");
  res.sendFile(INDEX_HTML);
});

app.listen(PORT, () => {
  console.log(`[server] Rentauto listening on port ${PORT}`);
});
