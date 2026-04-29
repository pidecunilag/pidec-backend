# PIDEC 1.0 — Supabase Migrations

These SQL files are designed to be **pasted directly into the Supabase SQL Editor**, in numerical order. Each file is idempotent where possible (uses `IF NOT EXISTS`, `DROP ... IF EXISTS`, etc.) so re-running is safe.

## Execution order

Run these one at a time in the Supabase Dashboard → SQL Editor:

| #   | File                              | What it does                                                |
| --- | --------------------------------- | ----------------------------------------------------------- |
| 01  | `0001_extensions.sql`             | Enables required Postgres extensions (`pgcrypto`, `citext`) |
| 02  | `0002_enums.sql`                  | Creates all enum types used across tables                   |
| 03  | `0003_schema_editions.sql`        | `editions` table                                            |
| 04  | `0004_schema_users.sql`           | `public.users` profile table keyed off `auth.users`         |
| 05  | `0005_schema_teams.sql`           | `teams` table                                               |
| 06  | `0006_schema_team_invites.sql`    | `team_invites` (48h expiry)                                 |
| 07  | `0007_schema_submissions.sql`     | `submissions` with uniqueness on (team, edition, stage)     |
| 08  | `0008_schema_judges.sql`          | `judges` table (accounts for judge portal users)            |
| 09  | `0009_schema_judge_scores.sql`    | Per-judge raw scores (pre-admin-publish)                    |
| 10  | `0010_schema_feedback.sql`        | Consolidated published feedback per submission              |
| 11  | `0011_schema_tokens.sql`          | Department submission tokens                                |
| 12  | `0012_schema_notifications.sql`   | In-platform notifications                                   |
| 13  | `0013_schema_admin_logs.sql`      | Append-only audit log                                       |
| 14  | `0014_indexes.sql`                | All performance indexes                                     |
| 15  | `0015_triggers.sql`               | `updated_at` trigger + `handle_new_user` safety net         |
| 16  | `0016_rls_policies.sql`           | Row Level Security for every table                          |
| 17  | `0017_storage_buckets.sql`        | Two storage buckets: `submissions` + `public-assets`        |
| 18  | `0018_custom_auth_admin_seed.sql` | Custom-auth alignment + secure initial admin seed helper    |

## Notes

- Apply in order; later files assume earlier tables exist.
- All tables (except `admin_logs`) use soft deletes via `deleted_at`.
- `admin_logs` is append-only by policy (no `deleted_at`, no `UPDATE`/`DELETE` policies).
- RLS is **enabled everywhere** — the frontend (anon key) only reads what policies permit; the backend uses the service role key which bypasses RLS and enforces rules in the application layer.
- Session JWT lifetimes (15 min access / 7 day refresh) must be configured in **Project Settings → Auth → JWT Expiry**. SQL cannot set this.

## After running migrations

1. Seed the admin user using the helper function:
   ```sql
   -- Generate bcrypt hash directly in Postgres (cost 10) and seed/update admin.
   select public.seed_initial_admin(
     'admin@pidec.com.ng',
     crypt('CHANGE_ME_STRONG_PASSWORD', gen_salt('bf', 10)),
     'PIDEC Platform Admin'
   );
   ```
2. Create an initial `editions` row for PIDEC 1.0.
