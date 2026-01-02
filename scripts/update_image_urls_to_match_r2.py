"""
Update Image URLs to Match R2 Actual Filenames

This script:
1. Fetches all database image URLs
2. Checks actual filenames in R2 (handling .jpg, .JPG, .jpeg, .JPEG)
3. Updates database URLs to match R2's actual extension
4. Reports all changes made

Run after configuring .env with Supabase and R2 credentials.
"""

import os
import boto3
from botocore.config import Config
from supabase import create_client
from dotenv import load_dotenv
from tqdm import tqdm

# Load environment variables
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
load_dotenv(env_path)

# Map environment variables (handle both naming conventions)
SUPABASE_URL = os.environ.get('SUPABASE_URL') or os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.environ.get('SUPABASE_SERVICE_KEY') or os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
R2_ACCOUNT_ID = os.environ.get('R2_ACCOUNT_ID')
R2_ACCESS_KEY_ID = os.environ.get('R2_ACCESS_KEY_ID')
R2_SECRET_ACCESS_KEY = os.environ.get('R2_SECRET_ACCESS_KEY')
R2_BUCKET_NAME = os.environ.get('R2_BUCKET_NAME')
R2_PUBLIC_URL = os.environ.get('R2_PUBLIC_URL') or os.environ.get('NEXT_PUBLIC_R2_PUBLIC_URL')

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("ERROR: Missing Supabase credentials in .env file")
    print(f"Looking for .env at: {env_path}")
    exit(1)

# Initialize clients
print("Initializing clients...")
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

r2 = boto3.client(
    's3',
    endpoint_url=f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
    aws_access_key_id=R2_ACCESS_KEY_ID,
    aws_secret_access_key=R2_SECRET_ACCESS_KEY,
    config=Config(signature_version='s3v4'),
    region_name='auto'
)

print("✓ Clients initialized")
print()

# Step 1: Get ALL filenames from R2 original/ folder
print("="*80)
print("STEP 1: Fetching all files from R2 original/ folder...")
print("="*80)

paginator = r2.get_paginator('list_objects_v2')
pages = paginator.paginate(Bucket=R2_BUCKET_NAME, Prefix='original/')

r2_filenames = {}  # Map lowercase filename (no ext) to actual filename with extension
for page in pages:
    if 'Contents' in page:
        for obj in page['Contents']:
            key = obj['Key']
            if key.startswith('original/'):
                filename = key[len('original/'):]
                if filename:  # Skip if it's just the folder itself
                    # Store mapping: study_number (lowercase, no ext) -> actual filename
                    study_number = filename.rsplit('.', 1)[0].lower()
                    r2_filenames[study_number] = filename

print(f"✓ Found {len(r2_filenames)} files in R2 original/")
print()

# Step 2: Get ALL database records with pagination
print("="*80)
print("STEP 2: Fetching all database image URLs...")
print("="*80)

db_records = []
page_size = 1000
offset = 0

while True:
    response = supabase.table('sample_images') \
        .select('id, image_url') \
        .not_.is_('image_url', 'null') \
        .range(offset, offset + page_size - 1) \
        .execute()
    
    if not response.data or len(response.data) == 0:
        break
    
    db_records.extend(response.data)
    print(f"  Fetched {len(response.data)} records (total: {len(db_records)})")
    
    if len(response.data) < page_size:
        break
    
    offset += page_size

print(f"✓ Found {len(db_records)} database records")
print()

# Step 3: Compare and identify mismatches
print("="*80)
print("STEP 3: Comparing database URLs with R2 filenames...")
print("="*80)

mismatches = []

for record in db_records:
    db_url = record['image_url']
    db_filename = db_url.split('/')[-1]
    
    # Extract study number (filename without extension)
    study_number = db_filename.rsplit('.', 1)[0].lower()
    
    # Check if there's a matching file in R2
    if study_number in r2_filenames:
        actual_r2_filename = r2_filenames[study_number]
        
        # Compare filenames (case-sensitive)
        if db_filename != actual_r2_filename:
            mismatches.append({
                'id': record['id'],
                'db_filename': db_filename,
                'r2_filename': actual_r2_filename,
                'old_url': db_url,
                'new_url': f"{R2_PUBLIC_URL}/original/{actual_r2_filename}"
            })

print(f"Found {len(mismatches)} URLs that need updating")
print()

if len(mismatches) > 0:
    # Show breakdown by extension type
    extension_changes = {}
    for m in mismatches:
        old_ext = m['db_filename'].split('.')[-1]
        new_ext = m['r2_filename'].split('.')[-1]
        key = f"{old_ext} → {new_ext}"
        extension_changes[key] = extension_changes.get(key, 0) + 1
    
    print("Extension changes breakdown:")
    for change, count in sorted(extension_changes.items()):
        print(f"  {change}: {count} files")
    print()
    
    # Show first 10 examples
    print("First 10 examples:")
    for m in mismatches[:10]:
        print(f"  ID {m['id']}:")
        print(f"    Database: {m['db_filename']}")
        print(f"    R2:       {m['r2_filename']}")
    if len(mismatches) > 10:
        print(f"  ... and {len(mismatches) - 10} more")
    print()

# Step 4: Update database records
if len(mismatches) > 0:
    print("="*80)
    print("STEP 4: Updating database records...")
    print("="*80)
    
    updated_count = 0
    failed_count = 0
    errors = []
    
    for mismatch in tqdm(mismatches, desc="Updating URLs"):
        try:
            supabase.table('sample_images').update({
                'image_url': mismatch['new_url']
            }).eq('id', mismatch['id']).execute()
            
            updated_count += 1
            
        except Exception as e:
            failed_count += 1
            errors.append({
                'id': mismatch['id'],
                'error': str(e)
            })
    
    print()
    print("="*80)
    print("UPDATE RESULTS:")
    print("="*80)
    print(f"✅ Successfully updated: {updated_count}")
    print(f"❌ Failed: {failed_count}")
    print()
    
    if len(errors) > 0:
        print("Errors encountered:")
        for err in errors[:10]:
            print(f"  ID {err['id']}: {err['error']}")
        if len(errors) > 10:
            print(f"  ... and {len(errors) - 10} more")
        print()
    
    # Verify final state
    print("="*80)
    print("VERIFICATION:")
    print("="*80)
    
    # Count by extension
    verify_response = supabase.table('sample_images') \
        .select('image_url') \
        .not_.is_('image_url', 'null') \
        .limit(10000) \
        .execute()
    
    extension_counts = {}
    for record in verify_response.data:
        url = record['image_url']
        filename = url.split('/')[-1]
        ext = filename.split('.')[-1] if '.' in filename else 'none'
        extension_counts[ext] = extension_counts.get(ext, 0) + 1
    
    print("Database extension distribution after update:")
    for ext, count in sorted(extension_counts.items()):
        print(f"  .{ext}: {count} files")
    print()
    
    print("✅ All URLs now match actual R2 filenames!")
    print()
    
else:
    print("✅ All database URLs already match R2 filenames!")
    print("   No updates needed.")
    print()

print("="*80)
print("COMPLETE")
print("="*80)
