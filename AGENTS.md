# Agent instructions

## Work log rule (every agent: Claude, Codex, Cursor, people)

Cheap to follow: read only what is listed here.

1. **Before you start:** read `docs/AGENT_HANDOFF.md`, `docs/PROJECT_STATUS.md`, `docs/TASK_QUEUE.md`, the top of `WORKLOG.md`, and open issues/PRs. Confirm the actual default-branch head and latest deployment before claiming work. If another agent is active, coordinate rather than duplicating changes.
2. **Claim it:** add one line at the top of the log with status `active`.
3. **Before you stop:** update your line with the status (`done`, `PR #n`, `blocked: reason`) and the next step. Commit and push it with your work. Never stop with unlogged work.
4. One line per piece of work, newest first. Details go in the PR, not the log.
5. **Before stopping:** update all five continuity files (`docs/PROJECT_STATUS.md`, `docs/TASK_QUEUE.md`, `docs/AGENT_HANDOFF.md`, `docs/DEPLOYMENT.md`, `docs/DECISIONS.md`) with factual state, the real checked SHA, verification evidence, blockers and precise next step. Never claim 100% before LC1 is accepted.
6. Preserve the independent Rentauto app and shared TAKATAK identity boundary. Do not apply `supabase/migrations/20260930161000_takatak_integration_outbox.sql` to the production shared Supabase schema unchanged: it refers to obsolete `public.trips` and `public.user_roles`, and replaces shared auth triggers. See issue #39.

Line format: `YYYY-MM-DD | agent | branch → PR | status | what | next step`

## Brand rule

Everything visual or written for TAKATAK follows `BRAND.md` (logo, colours, tagline, services). Electric blue on deep navy; never the old gold "TK" logo; green is for status only.
