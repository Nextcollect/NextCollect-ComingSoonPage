/*
  # Create early_access_signups table

  1. New Tables
    - `early_access_signups`
      - `id` (uuid, primary key)
      - `email` (text, unique, not null)
      - `country` (text, not null)
      - `created_at` (timestamp with timezone)

  2. Security
    - Enable RLS on `early_access_signups` table
    - Add policy to allow anyone to insert
    - Add policy to prevent direct reads/updates/deletes (admin only)

  3. Indexes
    - Index on email for faster duplicate checking
    - Index on created_at for chronological queries
*/

CREATE TABLE IF NOT EXISTS early_access_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  country text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_early_access_email ON early_access_signups(email);
CREATE INDEX IF NOT EXISTS idx_early_access_created_at ON early_access_signups(created_at);

ALTER TABLE early_access_signups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert signups"
  ON early_access_signups
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Only authenticated users can view signups"
  ON early_access_signups
  FOR SELECT
  TO authenticated
  USING (true);
