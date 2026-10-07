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

// Baseline production security headers. Keep this intentionally conservative:
// Rentauto loads payment/auth resources from external providers, so a full
// connect-src/img-src CSP is maintained separately and should be rolled out
// only after browser verification.
app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Content-Security-Policy", "frame-ancestors 'self'");
  res.setHeader(
    "Permissions-Policy",
    "camera=(self), microphone=(self), geolocation=(self), payment=(self)"
  );
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  next();
});
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
      // index.html, robots.txt and sitemap.xml are not hashed: never cache them for a year.
      if (/(?:index\.html|robots\.txt|sitemap\.xml)$/.test(filePath)) {
        res.setHeader("Cache-Control", "no-cache");
      }
    },
  })
);

// Deployment probes must never fall through to the SPA. Keep them explicit,
// uncacheable and backed by the same dist directory the app serves.
app.get("/healthz", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.type("text/plain").status(200).send("ok");
});

app.get("/revision.txt", (_req, res) => {
  const revisionPath = path.join(DIST_DIR, "revision.txt");

  if (!fs.existsSync(revisionPath)) {
    return res.status(404).type("text/plain").send("revision missing");
  }

  res.setHeader("Cache-Control", "no-store");
  return res.type("text/plain").sendFile(revisionPath);
});

// SPA fallback — any non-asset GET returns index.html
app.get(/.*/, (_req, res) => {
  res.setHeader("Cache-Control", "no-cache");
  res.sendFile(INDEX_HTML);
});

app.listen(PORT, () => {
  console.log(`[server] Rentauto listening on port ${PORT}`);
});
