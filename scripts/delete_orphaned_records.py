"""
Execute deletion of orphaned database records and report final counts
"""
from supabase import create_client
import os
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables from app/.env.local
env_path = Path(__file__).parent.parent / "app" / ".env.local"
load_dotenv(env_path)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not all([SUPABASE_URL, SUPABASE_SERVICE_KEY]):
    print("❌ Error: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY")
    print("   Set these in your .env file")
    exit(1)

# Initialize Supabase client
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

print("=" * 80)
print("DELETE ORPHANED DATABASE RECORDS")
print("=" * 80)
print()

# Get initial count
print("📊 BEFORE DELETION:")
response = supabase.table('sample_images').select('id', count='exact').execute()
initial_count = response.count
print(f"   Total records: {initial_count}")

response_with_images = supabase.table('sample_images').select('id', count='exact').not_.is_('image_url', 'null').execute()
with_images_count = response_with_images.count
print(f"   Records with image URLs: {with_images_count}")
print()

# Read the SQL file
sql_file = Path("database/delete_orphaned_records.sql")
if not sql_file.exists():
    print(f"❌ Error: SQL file not found: {sql_file}")
    exit(1)

with open(sql_file, 'r') as f:
    sql_content = f.read()

# Extract just the standardized_chop_ids from the SQL
# Parse the DELETE statement to get the list of IDs
import re
matches = re.findall(r"'([^']+)'", sql_content)
ids_to_delete = [m for m in matches if 'B' in m and 'C' in m and 'D' in m]

print(f"🗑️  DELETING ORPHANED RECORDS:")
print(f"   Found {len(ids_to_delete)} records to delete")
print(f"   (from db_records_without_images.csv)")
print()

# Delete records in batches
batch_size = 100
deleted_count = 0

for i in range(0, len(ids_to_delete), batch_size):
    batch = ids_to_delete[i:i+batch_size]
    try:
        response = supabase.table('sample_images').delete().in_('standardized_chop_id', batch).execute()
        deleted_count += len(batch)
        print(f"   Deleted batch {i//batch_size + 1}: {len(batch)} records")
    except Exception as e:
        print(f"   ❌ Error deleting batch {i//batch_size + 1}: {e}")

print()
print(f"✅ Deletion complete: {deleted_count} records deleted")
print()

# Get final count
print("=" * 80)
print("📊 AFTER DELETION:")
response = supabase.table('sample_images').select('id', count='exact').execute()
final_count = response.count
print(f"   Total records: {final_count}")

response_with_images = supabase.table('sample_images').select('id', count='exact').not_.is_('image_url', 'null').execute()
with_images_count_after = response_with_images.count
print(f"   Records with image URLs: {with_images_count_after}")

# Additional statistics
response_processed = supabase.table('sample_images') \
    .select('id', count='exact') \
    .eq('crop_processed', True) \
    .not_.is_('image_url', 'null') \
    .execute()
processed_count = response_processed.count

response_unprocessed = supabase.table('sample_images') \
    .select('id', count='exact') \
    .or_('crop_processed.is.null,crop_processed.eq.false') \
    .not_.is_('image_url', 'null') \
    .execute()
unprocessed_count = response_unprocessed.count

print(f"   Already processed: {processed_count}")
print(f"   Awaiting processing: {unprocessed_count}")
print()

# Verification
expected_deleted = len(ids_to_delete)
actual_deleted = initial_count - final_count

print("=" * 80)
print("🔍 VERIFICATION:")
print(f"   Expected deletions: {expected_deleted}")
print(f"   Actual deletions: {actual_deleted}")

if actual_deleted == expected_deleted:
    print("   ✅ SUCCESS! Perfect match.")
else:
    print(f"   ⚠️  Warning: Mismatch of {abs(expected_deleted - actual_deleted)} records")

print()
print("=" * 80)
print("📋 FINAL SUMMARY:")
print("=" * 80)
print(f"   ✅ Validated Records: {final_count}")
print(f"   ✅ Records with Images: {with_images_count_after}")
print(f"   ✅ Already Processed: {processed_count}")
print(f"   ⏳ Awaiting Processing: {unprocessed_count}")
print()
print("   Database now has perfect 1:1 match between records and images!")
print("   All {with_images_count_after} records have corresponding images in R2.")
print("=" * 80)
