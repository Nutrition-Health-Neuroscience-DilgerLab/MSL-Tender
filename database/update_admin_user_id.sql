-- Update admin_users record to match new Supabase Auth user ID
UPDATE admin_users
SET id = '6ee71ec7-90f4-425a-bd7b-8dca10e27395'
WHERE email = 'rdilger2@illinois.edu';

-- Verify the update
SELECT id, email, full_name, role, is_active
FROM admin_users
WHERE email = 'rdilger2@illinois.edu';
