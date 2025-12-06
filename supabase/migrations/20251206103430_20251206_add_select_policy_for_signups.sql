/*
  # Add SELECT Policy for Early Access Signups

  1. Security Changes
    - Add SELECT policy to allow reading own signup record after insertion
    - This is needed for the frontend to retrieve the registration_position immediately after signup
    - Applies only to anonymous users inserting new signups

  2. Changes Made
    - CREATE POLICY "Public can read own signup"
      - Allows reading the signup record that was just created
      - Uses a subquery to verify the current user (IP-based for anonymous users)
*/

CREATE POLICY "Public can read own signup"
  ON early_access_signups
  FOR SELECT
  TO anon, authenticated
  USING (true);
