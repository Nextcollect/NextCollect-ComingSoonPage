/*
  # Add Registration Position Tracking

  1. New Columns
    - `registration_position` (integer, auto-incrementing)
      - Tracks the order of user registrations
      - Used to provide milestone messages in UI
  
  2. Changes Made
    - Added `registration_position` column with auto-increment trigger
    - Ensures proper ordering of registrations
    
  3. Important Notes
    - The position is automatically incremented for each new signup
    - Existing records will get positions starting from 1
    - This enables conditional messaging based on registration milestones
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'early_access_signups' AND column_name = 'registration_position'
  ) THEN
    ALTER TABLE early_access_signups ADD COLUMN registration_position INTEGER;
    
    CREATE SEQUENCE early_access_signups_position_seq START 1;
    
    UPDATE early_access_signups 
    SET registration_position = nextval('early_access_signups_position_seq');
    
    ALTER SEQUENCE early_access_signups_position_seq OWNED BY early_access_signups.registration_position;
    
    ALTER TABLE early_access_signups 
    ALTER COLUMN registration_position SET DEFAULT nextval('early_access_signups_position_seq');
  END IF;
END $$;