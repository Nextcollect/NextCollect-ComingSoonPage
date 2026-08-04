/*
  # C2 — close anon access to nextcollect_registration_records

  Implements D-001 / D-002. After this migration the edge function (service role) is the
  ONLY path that writes this table or reads a signup position. The public anon key — which
  ships in the browser bundle — loses all access.

  Runs after 20260802100000_baseline_production.sql, which captured the pre-C2 state and is
  therefore the rollback reference (see the recovery block at the end of this file).

  ⚠ SEQUENCING: between this migration and the D-002 edge-function deploy, client-side
  signup inserts fail. That is acceptable ONLY because production is already dark (D-012 —
  the deployed bundle points at a deleted Supabase project). Do not run this against a live
  signup path. See docs/PLAN.md → LAUNCH LIST.

  Postgres DDL is transactional and the Supabase CLI wraps each migration file in a
  transaction: if any statement below fails, the whole file rolls back and nothing changes.
*/

-- ---------------------------------------------------------------------------
-- 1. Remove both anon policies.
--    RLS is enabled (relrowsecurity = true, verified 2026-08-02), so with no policies
--    present anon is denied every command under RLS.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow public insert for registration"
  ON public.nextcollect_registration_records;

DROP POLICY IF EXISTS "Users can view own registration"
  ON public.nextcollect_registration_records;

-- ---------------------------------------------------------------------------
-- 2. Revoke the underlying grants.
--    Policies alone are NOT sufficient. anon holds arwdDxtm — INSERT, SELECT, UPDATE,
--    DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN — restrained only by RLS being on.
--    A single toggle of RLS would hand TRUNCATE to the public anon key. `authenticated`
--    holds identical grants and this project has no auth at all.
--    service_role is deliberately untouched: the edge function needs it.
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.nextcollect_registration_records FROM anon;
REVOKE ALL ON public.nextcollect_registration_records FROM authenticated;

REVOKE ALL ON SEQUENCE public.nextcollect_registration_records_position_seq FROM anon;
REVOKE ALL ON SEQUENCE public.nextcollect_registration_records_position_seq FROM authenticated;

-- ---------------------------------------------------------------------------
-- 3. Remove pre-launch test data.
--    Verified 2026-08-02: exactly ONE row matches this predicate (created_at
--    2026-03-14, the owner's own address from a local-dev test). It is included in the
--    D-008 export. Deleting it means the first real signup is #1 rather than #2.
--    Predicate is date-based rather than email-based so no address enters git history.
-- ---------------------------------------------------------------------------
DELETE FROM public.nextcollect_registration_records
WHERE created_at < '2026-08-02'::timestamptz;

-- ---------------------------------------------------------------------------
-- 4. Honest position numbering.
--    The sequence produced GAPS: a duplicate-email insert consumes nextval() BEFORE the
--    unique constraint rejects it, so registration_position was never the true Nth signup
--    (it stood at 6 with 1 row). The edge function now computes the true ordinal at insert
--    time and stores it — exact when issued, and stable afterwards, unlike a
--    computed-on-read ordinal which would shift when a row is erased under GDPR (D4).
--    Order matters: drop the default before the sequence it references.
-- ---------------------------------------------------------------------------
ALTER TABLE public.nextcollect_registration_records
  ALTER COLUMN registration_position DROP DEFAULT;

DROP SEQUENCE IF EXISTS public.nextcollect_registration_records_position_seq;

-- ---------------------------------------------------------------------------
-- 5. Drop the redundant index.
--    idx_registration_email duplicates nextcollect_registration_records_email_key (the
--    UNIQUE constraint's index) on the same column — pure write overhead. Folded in here
--    rather than given its own migration; it would not justify one alone.
--    idx_registration_created_at is KEPT and is now load-bearing: it keeps the count(*)
--    in the new insert cheap. Do not drop it.
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS public.idx_registration_email;

/*
  ===========================================================================
  THE EDGE FUNCTION'S INSERT (service role, RLS bypassed) BECOMES:

    INSERT INTO public.nextcollect_registration_records (email, country, registration_position)
    VALUES ($1, $2, (SELECT count(*) + 1 FROM public.nextcollect_registration_records))
    RETURNING registration_position;

  ponytail: count(*)+1 can collide under simultaneous inserts, giving two people the same
  number. Harmless on a waitlist, and UNIQUE(email) still holds. If it ever matters, take an
  advisory lock around the insert — not worth it at this volume.

  ===========================================================================
  ROLLBACK — verified against the baseline. Run as a single transaction.

  Steps 1, 2, 4 and 5 are fully reversible; the exact prior state is recorded in
  20260802100000_baseline_production.sql. Step 3 (the DELETE) is NOT reversible from the
  database — restore that row from the D-008 export if it is ever wanted.

    BEGIN;

    -- 5. restore the redundant index
    CREATE INDEX IF NOT EXISTS idx_registration_email
      ON public.nextcollect_registration_records USING btree (email);

    -- 4. restore the sequence, its position, and the column default
    CREATE SEQUENCE IF NOT EXISTS public.nextcollect_registration_records_position_seq
      START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
    SELECT setval('public.nextcollect_registration_records_position_seq', 6, true);
    ALTER TABLE public.nextcollect_registration_records
      ALTER COLUMN registration_position
      SET DEFAULT nextval('public.nextcollect_registration_records_position_seq'::regclass);

    -- 2. restore the grants (anon/authenticated previously held ALL = arwdDxtm)
    GRANT ALL ON public.nextcollect_registration_records TO anon, authenticated;
    GRANT ALL ON SEQUENCE public.nextcollect_registration_records_position_seq
      TO anon, authenticated;

    -- 1. restore both policies exactly as the baseline captured them
    CREATE POLICY "Allow public insert for registration"
      ON public.nextcollect_registration_records FOR INSERT TO anon
      WITH CHECK (
        email IS NOT NULL AND email <> '' AND country IS NOT NULL AND country <> ''
      );
    CREATE POLICY "Users can view own registration"
      ON public.nextcollect_registration_records FOR SELECT TO anon
      USING (true);

    COMMIT;

  NOTE: setval(..., 6, true) makes the next nextval() return 7, matching the pre-C2 state
  where last_value was 6 and had been consumed.
  ===========================================================================
*/
