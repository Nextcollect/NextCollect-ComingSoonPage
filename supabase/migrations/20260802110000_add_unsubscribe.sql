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
  ROLLBACK:
    ALTER TABLE public.nextcollect_registration_records DROP COLUMN IF EXISTS unsubscribed_at;
*/
