/*
  # C3 — rate limiting (D-003)

  Postgres table, not in-memory counters: edge functions run on ephemeral, horizontally
  scaled Deno isolates, so an in-process counter gives an attacker a fresh bucket per
  isolate. See D-003 for the full reasoning and the rejected alternatives.

  GDPR (D-005): the raw IP never reaches the database. The edge function sends a salted
  SHA-256 hash, and rows are purged once their window has passed. The per-email dimension is
  personal data too and carries the same retention. Lawful basis is abuse/fraud prevention as
  a legitimate interest (GDPR Recital 49).
*/

CREATE TABLE IF NOT EXISTS public.signup_throttle (
  dimension    text        NOT NULL CHECK (dimension IN ('ip', 'email')),
  key_hash     text        NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  attempts     integer     NOT NULL DEFAULT 1,
  PRIMARY KEY (dimension, key_hash)
);

COMMENT ON TABLE public.signup_throttle IS
  'Rate-limit counters. key_hash is a salted SHA-256 computed in the edge function — raw IPs '
  'and addresses are never stored. Rows are purged once their window expires (D-003/D-005).';

ALTER TABLE public.signup_throttle ENABLE ROW LEVEL SECURITY;

-- No policies: only the service role touches this, and service_role bypasses RLS.
-- Belt and braces, exactly as for the registrations table (C2).
REVOKE ALL ON public.signup_throttle FROM anon;
REVOKE ALL ON public.signup_throttle FROM authenticated;

/*
  Atomic check-and-increment. Doing this as two round trips from the edge function would race,
  and this is a security control, so it does the whole thing in one statement.

  SECURITY DEFINER with an explicit REVOKE — the direct lesson from count_estimate (D-007),
  which was dangerous precisely because it was SECURITY DEFINER and left executable by PUBLIC.
  This one is callable by service_role ONLY.

  Returns the number of seconds the caller must wait, or 0 when the request is allowed.
*/
CREATE OR REPLACE FUNCTION public.check_signup_throttle(
  p_dimension text,
  p_key_hash  text,
  p_limit     integer,
  p_window    interval
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row     public.signup_throttle%ROWTYPE;
  v_expires timestamptz;
BEGIN
  -- Opportunistic purge: keeps retention honest without a scheduled job, which would be
  -- more machinery than this volume warrants.
  DELETE FROM public.signup_throttle
  WHERE window_start < (now() - p_window);

  INSERT INTO public.signup_throttle AS t (dimension, key_hash)
  VALUES (p_dimension, p_key_hash)
  ON CONFLICT (dimension, key_hash) DO UPDATE
    SET attempts     = CASE
                         WHEN t.window_start < (now() - p_window) THEN 1
                         ELSE t.attempts + 1
                       END,
        window_start = CASE
                         WHEN t.window_start < (now() - p_window) THEN now()
                         ELSE t.window_start
                       END
  RETURNING * INTO v_row;

  IF v_row.attempts > p_limit THEN
    v_expires := v_row.window_start + p_window;
    RETURN GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_expires - now())))::integer);
  END IF;

  RETURN 0;
END;
$$;

REVOKE ALL ON FUNCTION public.check_signup_throttle(text, text, integer, interval) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_signup_throttle(text, text, integer, interval) FROM anon;
REVOKE ALL ON FUNCTION public.check_signup_throttle(text, text, integer, interval) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.check_signup_throttle(text, text, integer, interval) TO service_role;

/*
  ROLLBACK:
    DROP FUNCTION IF EXISTS public.check_signup_throttle(text, text, integer, interval);
    DROP TABLE IF EXISTS public.signup_throttle;
*/
