"""
Standardize ALL Image Extensions to .jpg (lowercase)

This script:
1. Analyzes R2 to count all extension variants
2. Identifies majority extension as the standard
3. Renames ALL R2 files to .jpg (lowercase) - the standard
4. Updates ALL database URLs to match .jpg (lowercase)
5. Verifies all extensions are now uniform

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

# STANDARD: .jpg (lowercase) - we'll rename everything to this
STANDARD_EXTENSION = '.jpg'

# Step 1: Analyze R2 extensions
print("="*80)
print("STEP 1: Analyzing R2 file extensions...")
print("="*80)

paginator = r2.get_paginator('list_objects_v2')
pages = paginator.paginate(Bucket=R2_BUCKET_NAME, Prefix='original/')

r2_files = []
extension_counts = {}

for page in pages:
    if 'Contents' in page:
        for obj in page['Contents']:
            key = obj['Key']
            if key.startswith('original/'):
                filename = key[len('original/'):]
                if filename:  # Skip if it's just the folder itself
                    ext = '.' + filename.split('.')[-1] if '.' in filename else 'none'
                    extension_counts[ext] = extension_counts.get(ext, 0) + 1
                    r2_files.append(filename)

print(f"✓ Found {len(r2_files)} files in R2 original/")
print()
print("Extension breakdown:")
for ext, count in sorted(extension_counts.items(), key=lambda x: -x[1]):
    print(f"  {ext}: {count} files")
print()

# Step 2: Identify files that need renaming in R2
files_to_rename = []
for filename in r2_files:
    current_ext = '.' + filename.split('.')[-1] if '.' in filename else ''
    if current_ext != STANDARD_EXTENSION:
        study_number = filename.rsplit('.', 1)[0]
        new_filename = f"{study_number}{STANDARD_EXTENSION}"
        files_to_rename.append({
            'old_key': f"original/{filename}",
            'new_key': f"original/{new_filename}",
            'old_filename': filename,
            'new_filename': new_filename,
            'study_number': study_number
        })

print(f"Files that need renaming to {STANDARD_EXTENSION}: {len(files_to_rename)}")
print()

if len(files_to_rename) > 0:
    print("First 10 examples:")
    for item in files_to_rename[:10]:
        print(f"  {item['old_filename']} → {item['new_filename']}")
    if len(files_to_rename) > 10:
        print(f"  ... and {len(files_to_rename) - 10} more")
    print()

# Step 3: Rename files in R2 (copy to new name, delete old)
if len(files_to_rename) > 0:
    print("="*80)
    print("STEP 2: Renaming files in R2...")
    print("="*80)
    print(f"⚠️  This will rename {len(files_to_rename)} files in R2")
    print()
    
    renamed_count = 0
    failed_count = 0
    errors = []
    
    for item in tqdm(files_to_rename, desc="Renaming R2 files"):
        try:
            # Copy to new key
            r2.copy_object(
                Bucket=R2_BUCKET_NAME,
                CopySource={'Bucket': R2_BUCKET_NAME, 'Key': item['old_key']},
                Key=item['new_key'],
                CacheControl='public, max-age=31536000, immutable'
            )
            
            # Delete old key
            r2.delete_object(
                Bucket=R2_BUCKET_NAME,
                Key=item['old_key']
            )
            
            renamed_count += 1
            
        except Exception as e:
            failed_count += 1
            errors.append({
                'file': item['old_filename'],
                'error': str(e)
            })
    
    print()
    print("R2 RENAME RESULTS:")
    print(f"✅ Successfully renamed: {renamed_count}")
    print(f"❌ Failed: {failed_count}")
    print()
    
    if len(errors) > 0:
        print("Errors encountered:")
        for err in errors[:10]:
            print(f"  {err['file']}: {err['error']}")
        if len(errors) > 10:
            print(f"  ... and {len(errors) - 10} more")
        print()
else:
    print("✓ All R2 files already use standard extension!")
    print()

# Step 4: Update ALL database URLs to use standard extension
print("="*80)
print("STEP 3: Updating database URLs to standard extension...")
print("="*80)

# Fetch all database records
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
    
    if len(response.data) < page_size:
        break
    
    offset += page_size

print(f"✓ Found {len(db_records)} database records")
print()

# Find records that need updating
urls_to_update = []
for record in db_records:
    url = record['image_url']
    filename = url.split('/')[-1]
    current_ext = '.' + filename.split('.')[-1] if '.' in filename else ''
    
    if current_ext != STANDARD_EXTENSION:
        study_number = filename.rsplit('.', 1)[0]
        new_filename = f"{study_number}{STANDARD_EXTENSION}"
        new_url = f"{R2_PUBLIC_URL}/original/{new_filename}"
        
        urls_to_update.append({
            'id': record['id'],
            'old_url': url,
            'new_url': new_url
        })

print(f"Database URLs that need updating: {len(urls_to_update)}")
print()

if len(urls_to_update) > 0:
    print("First 10 examples:")
    for item in urls_to_update[:10]:
        print(f"  {item['old_url'].split('/')[-1]} → {item['new_url'].split('/')[-1]}")
    if len(urls_to_update) > 10:
        print(f"  ... and {len(urls_to_update) - 10} more")
    print()
    
    updated_count = 0
    failed_count = 0
    errors = []
    
    for item in tqdm(urls_to_update, desc="Updating database URLs"):
        try:
            supabase.table('sample_images').update({
                'image_url': item['new_url']
            }).eq('id', item['id']).execute()
            
            updated_count += 1
            
        except Exception as e:
            failed_count += 1
            errors.append({
                'id': item['id'],
                'error': str(e)
            })
    
    print()
    print("DATABASE UPDATE RESULTS:")
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
else:
    print("✓ All database URLs already use standard extension!")
    print()

# Step 5: Final verification
print("="*80)
print("VERIFICATION:")
print("="*80)

# Count R2 extensions after rename
print("Counting R2 extensions after standardization...")
paginator = r2.get_paginator('list_objects_v2')
pages = paginator.paginate(Bucket=R2_BUCKET_NAME, Prefix='original/')

r2_extension_counts = {}
r2_total = 0

for page in pages:
    if 'Contents' in page:
        for obj in page['Contents']:
            key = obj['Key']
            if key.startswith('original/'):
                filename = key[len('original/'):]
                if filename:
                    ext = '.' + filename.split('.')[-1] if '.' in filename else 'none'
                    r2_extension_counts[ext] = r2_extension_counts.get(ext, 0) + 1
                    r2_total += 1

print(f"R2 extension distribution (total: {r2_total}):")
for ext, count in sorted(r2_extension_counts.items()):
    print(f"  {ext}: {count} files")
print()

# Count database extensions after update
verify_response = supabase.table('sample_images') \
    .select('image_url') \
    .not_.is_('image_url', 'null') \
    .limit(10000) \
    .execute()

db_extension_counts = {}
for record in verify_response.data:
    url = record['image_url']
    filename = url.split('/')[-1]
    ext = '.' + filename.split('.')[-1] if '.' in filename else 'none'
    db_extension_counts[ext] = db_extension_counts.get(ext, 0) + 1

print(f"Database extension distribution (total: {len(verify_response.data)}):")
for ext, count in sorted(db_extension_counts.items()):
    print(f"  {ext}: {count} files")
print()

# Check if standardized
r2_standardized = len(r2_extension_counts) == 1 and STANDARD_EXTENSION in r2_extension_counts
db_standardized = len(db_extension_counts) == 1 and STANDARD_EXTENSION in db_extension_counts

print("="*80)
print("FINAL STATUS:")
print("="*80)
if r2_standardized and db_standardized:
    print(f"✅ SUCCESS! All files standardized to {STANDARD_EXTENSION}")
    print(f"   R2: {r2_total} files, all using {STANDARD_EXTENSION}")
    print(f"   Database: {len(verify_response.data)} records, all using {STANDARD_EXTENSION}")
else:
    print("⚠️  Standardization incomplete:")
    if not r2_standardized:
        print(f"   R2 still has multiple extensions: {list(r2_extension_counts.keys())}")
    if not db_standardized:
        print(f"   Database still has multiple extensions: {list(db_extension_counts.keys())}")
print("="*80)
