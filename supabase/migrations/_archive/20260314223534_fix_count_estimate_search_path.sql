/*
  # Fix count_estimate search_path security warning

  The Supabase security advisor flags functions with a mutable search_path.
  This migration defines count_estimate in the public schema with a pinned
  search_path so it cannot be hijacked via schema injection.

  If the pg_temp_22.count_estimate warning reappears after refreshing the
  advisor, this migration ensures a secure public-schema version exists that
  takes precedence.
*/

CREATE OR REPLACE FUNCTION public.count_estimate(query text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  rec    record;
  rows   bigint;
BEGIN
  FOR rec IN EXECUTE 'EXPLAIN ' || query LOOP
    rows := substring(rec."QUERY PLAN" FROM ' rows=([[:digit:]]+)');
    EXIT WHEN rows IS NOT NULL;
  END LOOP;
  RETURN rows;
END;
$$;
