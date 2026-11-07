# RENTAUTO.CA — ARCHITECTURE DECISIONS

## 2026-11-07 — Sequential release checkpoint (current)

Signature: Codex — ChatGPT Work.

- BEFORE: claimed `codex/sequential-release-20261107` from main `0f451af2743c0bad5b2798c75a7694a1b8d90b1a`; read AGENTS, continuity, issues #39/#40/#41 and PR #42. Historical KLEAN note merged by ancestry, not treated as current hosting proof.
- Verified production: DNS apex/www is `209.145.49.63`; existing Coolify application `rcsnisdtwllynxnoce6cehll` (id 24, controller on VPS2, actual destination VPS1), Nixpacks, `node server.cjs`, port 3000. Running image is the baseline main SHA; public HTML SHA-256 `d84c6ef912dc843ca42d0c13276ce060e6855b69047d60ad9493e6a97aa011ec` matches `/app/dist/index.html`. `/healthz` returns plain `ok`; `/revision.txt` is missing. No persistent container mounts. Configured shared Supabase hostname matches `pcjfahhlozsseqqevimi.supabase.co`.
- DURING: production build now stamps `dist/revision.txt` from SOURCE_COMMIT, then GITHUB_SHA, then git HEAD; malformed supplied revisions fail. Explicit revision route precedes long-lived static caching and returns no-store even when missing. Actual HTTP test covers success, missing revision and unchanged health response. Enable Coolify Include Source Commit in Build before deployment.
- Retire automatic MochaHost writes: legacy workflow retained for an explicitly selected manual rollback (`confirm_mochahost=true` and repository variable `RENTAUTO_DEPLOY_TARGET=mochahost`); no CI-completion trigger. This does not migrate DNS or alter the old host. Production remains the existing Coolify target.
- Lockfile reconciliation: existing package.json declared AI SDK/react-markdown packages absent from the lock. npm install filled 94 missing transitive entries and resolved use-sync-external-store 1.5.0 to 1.7.0; no package.json version changes. CI and deployment use npm ci with the committed lock and existing legacy-peer-deps setting. Exact candidate tests/build and both isolated PostgreSQL CI jobs must pass before merge/deploy.
- Branch reconciliation: historical host/guest/driver, booking, cancellation, reviews, payouts, support, tracking and identity branches have their feature files or equivalent consolidated commits in newer main. Do not merge old copies of App/types/Stripe handlers back over current source. Five fully patch-equivalent branches require no write. Old hosting diagnostic branches are not enabled; seo-legal-kit remains a separate unreviewed integration. Preserve all refs.
- Files changed: package.json/package-lock.json, server.cjs, scripts/write-release.mjs, release provenance tests, both workflow install commands, legacy workflow trigger, WORKLOG, historical note preface, and all five continuity files.
- Local verification completed: Node 22 frozen npm ci, typecheck, edge-source parity (24 canonical functions), migration guard, 102 tests / 15 files, production build, full lint (0 errors, 11 existing warnings). GitHub exact-candidate PostgreSQL jobs and main deployment receipt still pending.
- AFTER source preparation: validation and merge pending; this checkpoint does not certify the new build live. Exact SHA/run/container/public revision receipt will be posted on the release PR and #40 after checks. Rollback image must be retained first. No DB migration, Edge Function, secret, Stripe/SMS/GPS or real customer operation is included.
- Blockers retained: #39 second HTTP writer is disabled; shared direct projections remain canonical. Do not apply the obsolete global-auth/outbox migration. #41 LC1 real host/guest/payment/refund/return/GPS sign-off remains incomplete. Old MochaHost #40 errors are historical and not the active hosting diagnosis.
- Exact next action: run frozen dependency install, typecheck, edge parity, migration safety, tests/lint/build, then green candidate and main CI; deploy the exact main through the existing Coolify target and verify uncached public revision, runtime hashes and UI. Publish signed AFTER receipt and proceed to the next repository.

Earlier entries below are historical; this checkpoint supersedes their hosting assumptions.


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

12. **2026-10-15 staging-first outbox**: prepare a future Rentauto-owned durable event outbox only in `rentauto` schema. No global auth/profiles triggers, service-role-only RPCs and lease-fenced ack; enabled=false until TAKATAK master database separation and receiver flow are verified. Keep SQL outside `supabase/migrations` pending proper CLI-generated reviewed migration, and never apply obsolete global-trigger migration.

13. **2026-10-15 staging execution gate:** Run outbox SQL against a disposable GitHub Actions PostgreSQL 16 service, verify roles, RLS, gated account/payment triggers, lease fencing and retry. CI must block deploy on SQL failure, while production backend remains unchanged.

14. **2026-10-15 kill switch / legacy mapping:** The `enabled=false` database setting must stop both event creation and claiming pending work; an operator disable may still allow in-flight deliveries, but no new leases. Rentauto source profiles can preserve a historical external user ID, so use the existing master identity link as a fallback within the RENTAUTO source boundary.

15. **2026-10-15 executable SQL CI as release gate:** Never treat source-only static checks as proof staged SQL parses. The disposable PostgreSQL CI correctly caught an invalid PL/pgSQL delimiter; keep this job blocking release until fully green.

16. **2026-10-16 shared-DB identity authority:** Two TAKATAK V1 Prisma migrations are installed in the same Supabase database containing Rentauto trips and TAKATAK master projections. Existing Rentauto bootstrap and order trigger are the canonical server-scoped transactional integration. A second HTTP outbox sender in this same deployment would risk duplicate customer/payment mutations and must not be enabled until a distinct receiver datastore, authorization and idempotency needs are proven.

17. **2026-10-16 external receiver guarded by independent-store proof:** Do not assume that a populated endpoint and HMAC keys authorize a second TAKATAK writer. Outbox sender's backend requires exact `TAKATAK_RENTAUTO_SYNC_INDEPENDENT_STORE_CONFIRMED=true` before any claims; absent/false values fail closed. Never set the variable for the current co-resident Prisma/Supabase architecture.

## 2026-10-16 CI lint correctness
19. 2026-10-16: Gate new TypeScript changes in CI by comparing actual push/PR base to HEAD; preserve separate full-repository lint debt report.

20. **2026-10-16 lint remediation without rule suppressions:** Prefer typed domain records and Web Speech structural types, proper TypeScript imports and safe error narrowing; do not silence global lint through ignored files. Preserve browser voice processing disclosure accuracy.

21. **2026-10-16 remaining lint errors:** Replace concierge untyped tool-output shapes and unsafe ID access with bounded component props and explicit runtime type narrowing; use standard fetch signatures; fix preview timer binding. Promote `npm run lint` only after verifying all errors are actually cleared.

22. **2026-10-16 full-repository ESLint quality gate:** After actual CI proved no remaining lint errors, make `npm run lint` blocking rather than advisory. Existing 11 React Fast Refresh warnings are nonfatal; changes must not introduce new ESLint errors.
