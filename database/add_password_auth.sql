-- Add password column to admin_users table
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Update your user with a password (you'll need to run this with your actual hashed password)
-- For now, we'll set up the structure. You can set a password through the UI after deployment.

-- Create a function to set admin password (will be called from application)
CREATE OR REPLACE FUNCTION set_admin_password(user_id UUID, new_password TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE admin_users
  SET password_hash = crypt(new_password, gen_salt('bf'))
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to verify admin password
CREATE OR REPLACE FUNCTION verify_admin_password(user_email TEXT, password TEXT)
RETURNS TABLE(user_id UUID, is_valid BOOLEAN) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    id,
    CASE 
      WHEN password_hash IS NULL THEN FALSE
      WHEN password_hash = crypt(password, password_hash) THEN TRUE
      ELSE FALSE
    END as is_valid
  FROM admin_users
  WHERE email = user_email AND is_active = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION set_admin_password(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION verify_admin_password(TEXT, TEXT) TO anon;
