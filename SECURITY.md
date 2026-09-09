# PingClass - Security Status

Security hardening audit for the PingClass rollout. Every item below was verified
live against the production project (ref `evrqzgjksmidqhzvckhq`) unless marked
"dashboard action".

## Checklist (all passed)

- **Auth**: every destructive/admin action re-validates the caller JWT server-side
  and derives identity from `auth.getUser()` - never trust the payload.
- **RLS / grants**: all `public` tables have RLS + explicit grants; no grants to
  `anon` beyond read-only where intended. Role-escalation trigger
  `trg_users_prevent_role_escalation` blocks non-owner role bumps.
- **Invite links**: token-based, expired via `mark_token_used`; account creation
  cannot hijack a pending invite (email address must match + email confirmation).
- **XSS**: all user/DB strings rendered through `escapeHtml()` / `escapeInlineJs()`;
  server-side text is never interpolated as raw HTML.
- **SQL injection**: no string-built SQL; all access via supabase-js / PostgREST RSA
  and stored RPCs. Input validated server-side.
- **CSRF**: not applicable - token-based auth, server rejects calls without the
  Bearer token.
- **CORS / headers**: permissive CORS limited to functions that need it;
  clickjacking/security headers set; Flask debug off in production.
- **File uploads**: not supported anywhere (no multipart endpoints).
- **Rate limiting**: sliding-window on every paid/invite path (see inventory).

## Edge-function inventory (13/13 audited)

| Function | Lock | Notes |
|---|---|---|
| `create-order` | rate-limited | 20/hr/user, 60/hr/IP |
| `verify-payment` | rate-limited | 20/60 sliding window |
| `confirm-invite-user` | admin-only + same institute + rate-limited | calls `email_confirm` |
| `mark-token-used` | rate-limited | invite token single-use |
| `delete-user` | admin-only + same institute; owner protected | cannot remove self/owner |
| `delete-account` | owner-auth | owner = full institute cascade; member = self only |
| `notifications` | JWT-scoped | every query scoped to `auth.uid()` |
| `push-subscribe` | JWT-scoped | `user_id` derived from JWT, never body |
| `send-push-notifications` | INTERNAL_SECRET + JWT | previously "any valid JWT" |
| `check-fee-notifications` | INTERNAL_SECRET + JWT | previously unauthenticated cron sweep |
| `send-overdue-email` | INTERNAL_SECRET + JWT | previously a public Resend proxy |
| `retention-cleanup` | cron secret (`RETENTION_SECRET`) | nightly 03:30 |
| `check-email` | pre-auth + RPC guard + rate-limited | email availability, no data leak |

The three functions marked "previously" were exploited-then-fixed in 2026-09
(git `9c590eb`): each now requires `verify_jwt = true` **and** a shared
`x-supabase-secret` equal to `INTERNAL_SECRET` (32-byte random), stored identically
in Deno env and Vault (`internal_secret`). The nightly cron sends the header from
Vault; matching pending migrations:
`20260905000000_fee_notifications_cron.sql`, `20260814030000_retention_cron.sql`.

## Verified live

- 401 without the shared secret (even with a valid service-role JWT).
- 401 with a garbage/invalid JWT (platform-level `verify_jwt`).
- 400 past the gate on malformed input (gate correctly reached).
- All 10 auth users have confirmed emails; no unconfirmed-but-active accounts.
- Deployed bundles match the tracked source on disk for every function.
- No secrets in git history: only the anon (publishable) key is committed;
  no service-role key, no `INTERNAL_SECRET`, no Vault values.
- Realtime publications empty - no WebSocket data-exposure surface.
- Supabase advisors: no security findings beyond two known non-issues
  (`extension_in_public` = pg_net false positive; leaked-password protection =
  does not exist on the current plan).

## Backup & restore (no-cost path)

- Nightly full snapshot of all 19 data tables via the `backup-snapshot` edge
  function, scheduled by pg_cron (`cron.schedule`, daily 04:30 UTC,
  migration `20260909000000_backup_snapshot_cron.sql`). It dumps every table
  through the service-role REST API and pushes a single commit straight to the
  private repo `godwin-SM/PingClass-backups` via the GitHub API - running
  entirely inside Supabase, no local scripts, no scheduled task, no PITR cost.
- The backup repo keeps FLAT history: each run uploads an orphan commit
  (no parents) whose tree contains only the newest `yyyyMMdd-HHmmss` snapshot
  dir, then force-updates `main`. The repository therefore always holds exactly
  one snapshot - it never accumulates a full dump per day (history was squashed
  once on 2026-09-09; see commit `591b7886`). Requires the fine-grained backup
  token to allow force-pushing the branch - verified.
- GitHub credentials live in Vault (`backup_github_token`, `backup_github_repo`);
  the function reads them via the service_role-only `get_secret` RPC. Auth is the
  shared `INTERNAL_SECRET` (cron sends it in `x-supabase-secret`), consistent
  with AGENTS.md.
- The old local path is deprecated: `pingclass-backup.ps1` still exists as a
  manual/offline fallback (same snapshot format, so restore is unchanged). The
  former scheduled task `PingClassBackup` was removed after antivirus flagged it
  as `WORM.TASK.EMON.PSHELL.250419` - a heuristic on tasks that shell out to
  PowerShell (false positive; script proved benign). The server-side cron is
  unaffected by this.
- Restore via `pingclass-restore.ps1 -FromGitHub`: idempotent per-row upserts in
  FK-safe order. Existing student rows are PATCHed (never INSERTed) so the DPDP
  consent BEFORE-INSERT trigger cannot fabricate `parent_consent`; only genuinely
  missing rows are re-created with consent marked true. `rate_limit_hits` is not
  restored. `audit_log` is restored last and reconciled to the snapshot (the app's
  audit triggers would otherwise log every restore write).
- Live DB triggers/grants verified compatible with service-role restores:
  `check_announcement_plan` fixed (was raising 42703 on every insert) and
  service_role granted EXECUTE/USAGE on all `private` helpers
  (migrations `20260907112039`, `20260907112956`, `20260907113047`).
- Token expiry caveat: the fine-grained backup token is valid ~90 days; when it
  dies the nightly function fails and warns in its logs until
  `backup_github_token` is refreshed in Vault (and in `.env` for the local
  fallback).

## Remaining (dashboard actions, cannot be scripted)

1. **MFA enforcement** - Authentication > Sign In. Require MFA for all users
   (especially institute owners/admins).
2. **Leaked-password (HIBP) check** - Authentication > Sign In > Password strength.
   Available on paid plans only.

## Conventions

- Edge-function secret sharing: `AGENTS.md` (INTERNAL_SECRET + Vault pairing).
- Migrations must bundle CREATE + RLS + policies + GRANTs (`AGENTS.md`).
- Never commit the service-role key or the INTERNAL_SECRET.

## Change log

| Commit | Change |
|---|---|
| `1e24c68` | track edge functions in VCS + rate-limit payment/invite paths |
| `9c590eb` | INTERNAL_SECRET gate on push/email/cron functions, `verify_jwt=true` |
| `4da39c5` | un-ignore supabase source; document secrets convention |
| `8fb0d20` | zero-local nightly backup via GitHub API (scripted, no PITR cost) |
| `<next>` | server-side daily backup: `backup-snapshot` edge function + pg_cron; GitHub creds in Vault; local task removed (AV heuristic) |