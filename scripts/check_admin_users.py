from dotenv import load_dotenv
import os
from supabase import create_client

load_dotenv()
supabase = create_client(
    os.getenv('NEXT_PUBLIC_SUPABASE_URL'),
    os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
)

# Check current admin_users
result = supabase.table('admin_users').select('*').execute()
print('Current admin_users:')
for u in result.data:
    print(f"ID: {u['id']}, Email: {u['email']}, Name: {u.get('full_name', 'N/A')}")

print('\nThe new user ID should be: 6ee71ec7-90f4-425a-bd7b-8dca10e27395')
print('\nYou need to either:')
print('1. Delete the old admin_users record and create a new one with the new ID')
print('2. Or update the existing record (if the ID allows it)')
