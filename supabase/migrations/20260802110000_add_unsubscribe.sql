/*
  # Unsubscribe support (D3 / GDPR launch condition)

  Soft opt-out, not deletion. Deliberate: a hard delete would shift every later
  registration_position, because the edge function computes the ordinal from count(*).
  Someone opting out of email must not silently renumber other people's "you're #N".

  GDPR *erasure* (D4) is a different operation and IS a hard delete — that is when the
  ordinal fix (COALESCE(MAX(...),0)+1) has to land. See PLAN.md → "OPEN — position
  ordinals can be REUSED once GDPR deletion exists".

  No anon grants are added. The unsubscribe edge function uses the service role, exactly
  like signup. The table stays unreachable from the browser (D-002).
*/

ALTER TABLE public.nextcollect_registration_records
  ADD COLUMN IF NOT EXISTS unsubscribed_at timestamptz;

COMMENT ON COLUMN public.nextcollect_registration_records.unsubscribed_at IS
  'Set when the recipient opts out via List-Unsubscribe. NULL = still subscribed. '
  'Soft opt-out so registration_position ordinals stay stable; GDPR erasure is a hard delete.';

/*
  Locale captured at signup.

  Needed so the unsubscribe page can be shown in the language the person actually signed up
  in. An English-only exit wall is friction, and friction on an unsubscribe converts directly
  into spam complaints — which this domain cannot afford (see the reputation watch item in
  docs/PLAN.md). It also lets the confirmation email be localised later.

  CHECK constrains it to the six supported locales, so a bad value fails at the boundary
  rather than silently rendering English.
*/
ALTER TABLE public.nextcollect_registration_records
  ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'en';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'nextcollect_registration_records_locale_check'
  ) THEN
    ALTER TABLE public.nextcollect_registration_records
      ADD CONSTRAINT nextcollect_registration_records_locale_check
      CHECK (locale IN ('en', 'nl', 'de', 'fr', 'es', 'it'));
  END IF;
END $$;

COMMENT ON COLUMN public.nextcollect_registration_records.locale IS
  'Language the person signed up in, used for the unsubscribe page and future localised email.';

/*
  ROLLBACK:
    ALTER TABLE public.nextcollect_registration_records
      DROP CONSTRAINT IF EXISTS nextcollect_registration_records_locale_check;
    ALTER TABLE public.nextcollect_registration_records DROP COLUMN IF EXISTS locale;
    ALTER TABLE public.nextcollect_registration_records DROP COLUMN IF EXISTS unsubscribed_at;
*/
