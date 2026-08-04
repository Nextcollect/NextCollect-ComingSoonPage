/*
  # Baseline — production state as captured 2026-08-02

  Project: nofzyhxjpsikdhbcpfuo. Captured by read-only introspection of the live
  database (pg_class, pg_indexes, pg_policies, pg_constraint, pg_sequence).

  WHY THIS FILE EXISTS
  The remote had NO migration ledger — `supabase_migrations` did not exist and none
  of the six earlier migration files had ever been applied. The live schema was built
  by hand, and at least one earlier file actively contradicted production. Those six
  files are archived under `_archive/` and describe history that never ran.

  This file describes production EXACTLY AS IT WAS, including the two permissive
  policies. They are removed by the NEXT migration, not this one — a baseline must be
  honest about the starting point, not aspirational.

  DELIBERATELY EXCLUDED (Supabase-managed — must not become ours to own):
    - Default privilege GRANTs to anon/authenticated/service_role (stock Supabase)
    - Extensions (gen_random_uuid() is core Postgres 13+)
    - auth / storage / graphql / vault / pgbouncer schemas
    - the supabase_migrations ledger itself
*/

-- NOTE: production has no OWNED BY on this sequence. Reproduced faithfully — see note 1.
CREATE SEQUENCE IF NOT EXISTS public.nextcollect_registration_records_position_seq
  START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

CREATE TABLE IF NOT EXISTS public.nextcollect_registration_records (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email                 text UNIQUE NOT NULL,
  country               text NOT NULL,
  created_at            timestamptz DEFAULT now(),
  registration_position integer DEFAULT nextval('public.nextcollect_registration_records_position_seq'::regclass)
);

-- Present in production, created by NO migration in this repo. See note 2.
CREATE INDEX IF NOT EXISTS idx_registration_created_at
  ON public.nextcollect_registration_records USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_registration_email
  ON public.nextcollect_registration_records USING btree (email);

ALTER TABLE public.nextcollect_registration_records ENABLE ROW LEVEL SECURITY;

-- Live policies, verbatim. Both are dropped by the next migration.
-- NOTE: this INSERT policy is the migration-2 version, NOT the `WITH CHECK (true)`
-- that archived migration 5 claims. Production was always the stricter one.
CREATE POLICY "Allow public insert for registration"
  ON public.nextcollect_registration_records FOR INSERT TO anon
  WITH CHECK (
    email IS NOT NULL AND email <> '' AND country IS NOT NULL AND country <> ''
  );

CREATE POLICY "Users can view own registration"
  ON public.nextcollect_registration_records FOR SELECT TO anon
  USING (true);

/*
  BASELINE NOTES — do not silently "fix" these here

  1. The sequence has no OWNED BY (pg_depend shows no auto dependency), so dropping
     the table would leave it dangling. Reproduced as-is. The next migration removes
     the sequence entirely, which resolves this.

  2. idx_registration_email duplicates nextcollect_registration_records_email_key
     (the UNIQUE constraint's index) on the same column — pure write overhead.
     Reproduced as-is; dropped by the next migration.

  3. Sequence last_value was 6 with 1 live row (gaps from duplicate-email attempts,
     which consume a value before the unique constraint rejects them). A baseline does
     not set sequence position.

  4. No triggers. No CHECK constraints beyond PK/UNIQUE. No functions in `public`
     (count_estimate has never existed on this project).
*/
