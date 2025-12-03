from dotenv import load_dotenv
import os
from supabase import create_client

load_dotenv()
supabase = create_client(
    os.getenv('NEXT_PUBLIC_SUPABASE_URL'),
    os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
)

# Create admin user record with new ID
new_admin = {
    'id': '6ee71ec7-90f4-425a-bd7b-8dca10e27395',
    'email': 'rdilger2@illinois.edu',
    'full_name': 'Ryan Dilger',
    'role': 'super_admin',
    'is_active': True
}

result = supabase.table('admin_users').insert(new_admin).execute()
print('Created admin user:')
print(result.data)
