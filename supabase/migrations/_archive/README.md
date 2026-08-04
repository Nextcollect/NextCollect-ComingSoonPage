# Archived migrations — NEVER APPLIED, and they do not describe production

These six files are kept for historical context only. **Do not run them. Do not move them
back into `supabase/migrations/`.**

## Why they are here

Phase A of the 2026-08 audit found that the remote database had **no migration ledger at all** —
the `supabase_migrations` schema did not exist, and `supabase migration list` returned empty. None
of these files had ever been applied through the CLI. The live schema was built by hand, through
the dashboard and SQL editor.

They are archived rather than deleted because they record *intent* — why the table was renamed,
why a position sequence exists — which is not recoverable from the current schema.

## They actively contradict production

This is the important part. At least three concrete divergences:

| File | Claims | Production actually has |
|---|---|---|
| `20260107141200_..._migrate_to_registration_records.sql` | INSERT policy `WITH CHECK (true)` | The stricter non-empty `email`/`country` check from `20251201195231` — production was **never** permissive here |
| *(none of them)* | — | `idx_registration_created_at` and `idx_registration_email`, both created outside migrations |
| `20260314223534_fix_count_estimate_search_path.sql` | Creates `public.count_estimate` | **Never existed.** Verified absent from `pg_proc`; `rpc/count_estimate` returns 404. It was written to silence an advisor warning about a *different, transient* `pg_temp_*` object that also no longer exists |

Migrations 1–4 also operate on `early_access_signups`, a table that no longer exists.

Replaying this directory against production would fail: `CREATE POLICY` has no `IF NOT EXISTS`,
so it would abort part-way and leave the schema in an unknown state.

## What replaced them

`../20260802100000_baseline_production.sql` — a single baseline captured by read-only
introspection of the live database on 2026-08-02. It describes production **exactly as it was**,
including the two permissive anon policies. Everything after that point is an ordinary forward
migration.

See `docs/DECISIONS.md` → **D-007** (never delete an applied migration; how this was handled) and
**D-010** (production and the repository had diverged).
