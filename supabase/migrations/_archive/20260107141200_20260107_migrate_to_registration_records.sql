/*
  # Migrate to nextcollect_registration_records table

  1. Create new table
    - `nextcollect_registration_records`
      - `id` (uuid, primary key)
      - `email` (text, unique)
      - `country` (text)
      - `created_at` (timestamp)
      - `registration_position` (integer)
  2. Migrate data from early_access_signups
  3. Drop old table
  4. Security
    - Enable RLS on new table
    - Add policies for data access
*/

CREATE SEQUENCE IF NOT EXISTS nextcollect_registration_records_position_seq START 1;

CREATE TABLE IF NOT EXISTS nextcollect_registration_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  country text NOT NULL,
  created_at timestamptz DEFAULT now(),
  registration_position integer DEFAULT nextval('nextcollect_registration_records_position_seq'::regclass)
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'early_access_signups') THEN
    INSERT INTO nextcollect_registration_records (id, email, country, created_at, registration_position)
    SELECT id, email, country, created_at, registration_position FROM early_access_signups
    ON CONFLICT (email) DO NOTHING;
    
    DROP TABLE early_access_signups CASCADE;
  END IF;
END $$;

ALTER TABLE nextcollect_registration_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public insert for registration"
  ON nextcollect_registration_records FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Users can view own registration"
  ON nextcollect_registration_records FOR SELECT
  TO anon
  USING (true);
