/*
  # Fix RLS Policies for Early Access Signups

  1. Security Changes
    - Remove overly permissive policy with WITH CHECK (true)
    - Add restrictive policy that validates email is not empty
    - Keep anonymous user insert access working correctly
*/

DROP POLICY IF EXISTS "Anyone can insert signups" ON early_access_signups;

CREATE POLICY "Public can insert signups"
  ON early_access_signups
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (email IS NOT NULL AND email != '' AND country IS NOT NULL AND country != '');
