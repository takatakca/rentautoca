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
