# RENTAUTO.CA — ARCHITECTURE DECISIONS

## Recorded decisions (2026-10-14)
1. **Preserve application**: Rentauto stays a standalone product/UX with its own rental-domain tables; GROUPE TAKATAK remains master identity/entitlements and unified customer context. No shared-dashboard auto-merging.
2. **Release model**: GitHub `main` → CI → immutable Vite artifact → MochaHost Passenger installed `app.js` → `CURRENT` + health SHA → rollback on failure. No heavy frontend builds on MochaHost.
3. **External secrets**: `VITE_*` holds browser-safe values only. Stripe secret, webhook secret, SMS, tracking, service-role and TAKATAK integration secrets remain on backend.
4. **Outbox migration safety**: old `20260930161000_takatak_integration_outbox.sql` is not fit for the deployed shared schema. Never apply as-is; it assumes `public.trips`, `public.user_roles` and modifies global auth triggers. Create an additive isolated replacement only after verifying current schema and destination contract.
5. **Preexisting TAKATAK projection**: account bootstrap and `rentauto.sync_takatak_marketplace_order_trigger` already project data directly to shared master; do not duplicate those effects with a parallel sender until their semantics are reconciled.
6. **Indexing**: noindex on private account/trip/admin paths and saved concierge conversations is SEO hygiene, not authorization. Supabase RLS and authenticated backend operations remain mandatory.
7. **Completion**: a green CI, `/healthz`, or screenshot never proves a real rental loop; LC1 field sign-off is required.

New changes should be append-only decisions with date, reasoning and tradeoffs. Do not silently rewrite history.

8. **Live role table authority (2026-10-14)**: `rentauto.account_roles` with `auth_user_id` and `role` is the RLS-protected production role source; obsolete `public.user_roles` cannot authorize Rentauto pages. Frontend requires a Rentauto role for any private route. TAKATAK Auth identity alone cannot bypass Rentauto consent.

8. **Read-back correction (2026-10-14):** `rentauto.user_roles` is a compatibility view; it was not missing. Canonical membership is `rentauto.account_roles` with `auth_user_id` and per-user/admin RLS.
9. **In-database TAKATAK sync:** the existing server function `rentauto.project_trip_to_takatak_marketplace_order` already handles Rentauto `source_marketplace_orders`; do not duplicate it with a blind outbox migration. Keep issue #39 for new requirements rather than claiming all integration is missing.

10. **2026-10-15 shared-Supabase migration gate:** historical outbox migration is not compatible with current global identity and rentauto schemas. CI checks its known historical body and rejects future GitHub Actions auto database pushes or migration-up/reset paths until explicitly reconciled. This protects the shared tenant authority without deleting audit history or disabling valid frontend releases.

11. **2026-10-15 transport trust boundary:** TAKATAK receiver exists in the master Next.js source at `/api/integrations/rentauto/events`. Do not treat generic HTTP 2xx as acceptance; require JSON `accepted:true`, disable redirects to avoid leaking signed headers, and restrict HTTPS destination to TAKATAK domains or an explicitly configured staging origin. Sender remains un-deployed until issue #39's data separation, migration and operational configuration are validated.
