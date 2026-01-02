"""
Restore 78 deleted sample_images records
Direct port of notebook STEP 2 cell - restores database records only (no image uploads)
"""
import os
from supabase import create_client
from dotenv import load_dotenv
from tqdm import tqdm

# Load environment variables
load_dotenv()

# Configuration
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
R2_PUBLIC_URL = "https://pub-54fd27572f2e4efc843722bee98239e0.r2.dev"

# 78 deleted filenames (from delete_orphaned_records_final.sql)
deleted_filenames = [
    '2304B00C0196D00.JPG', '2205B02C2209D01.JPG', '2205B01C2022D01.JPG', '2205B01C2043D01.JPG',
    '2205B02C2210D01.JPG', '2205B01C8115D01.JPG', '2205B02C2202D01.JPG', '2205B01C8050D01.JPG',
    '2205B02C2170D01.JPG', '2205B02C2194D01.JPG', '2205B01C2083D01.JPG', '2205B02C2197D01.JPG',
    '2205B02C2227D01.JPG', '2205B02C8165D01.JPG', '2304B00C0197D00.JPG', '2205B01C8037D01.JPG',
    '2205B01C8077D01.JPG', '2205B02C2186D01.JPG', '2205B02C8136D01.JPG', '2205B01C2069D01.JPG',
    '2205B02C2118D01.JPG', '2205B02C8163D01.JPG', '2205B02C8203D01.JPG', '2205B02C8238D01.JPG',
    '2205B02C8239D01.JPG', '2205B02C2187D01.JPG', '2205B01C2106D01.JPG', '2205B01C8041D01.JPG',
    '2205B01C8036D01.JPG', '2205B02C8208D01.JPG', '2205B01C2006D01.JPG', '2205B01C8025D01.JPG',
    '2205B01C8109D01.JPG', '2205B01C8127D01.JPG', '2205B02C2198D01.JPG', '2205B02C8190D01.JPG',
    '2205B01C2002D01.JPG', '2205B01C2015D01.JPG', '2205B01C2046D01.JPG', '2205B01C2068D01.JPG',
    '2205B01C8016D01.JPG', '2205B02C2148D01.JPG', '2205B02C2206D01.JPG', '2205B02C2215D01.JPG',
    '2205B02C8201D01.JPG', '2205B01C2014D01.JPG', '2205B01C8032D01.JPG', '2205B01C8042D01.JPG',
    '2205B01C8130D01.JPG', '2205B02C2171D01.JPG', '2205B02C8173D01.JPG', '2205B02C8253D01.JPG',
    '2205B02C8250D01.JPG', '2205B01C8063D01.JPG', '2205B02C8183D01.JPG', '2205B02C8224D01.JPG',
    '2205B01C2095D01.JPG', '2205B01C8020D01.JPG', '2205B01C8105D01.JPG', '2205B01C8107D01.JPG',
    '2205B02C8161D01.JPG', '2205B02C8209D01.JPG', '2205B01C2091D01.JPG', '2205B01C8007D01.JPG',
    '2205B01C2053D01.JPG', '2205B01C2017D01.JPG', '2205B01C8001D01.JPG', '2205B01C8073D01.JPG',
    '2205B02C2131D01.JPG', '2205B02C2155D01.JPG', '2205B01C2001D01.JPG', '2205B01C2104D01.JPG',
    '2205B02C2150D01.JPG', '2205B01C2048D01.JPG', '2205B02C8149D01.JPG', '2205B02C8202D01.JPG',
    '2205B02C8205D01.JPG', '2205B02C8215D01.JPG'
]

def restore_deleted_records():
    """Restore 78 deleted database records (exact port of notebook STEP 2 cell)"""
    
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("❌ Missing credentials in .env file")
        print("   Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY")
        return
    
    # Initialize Supabase client
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    print("Restoring 78 deleted records from original CSV data...")
    print()
    
    # Extract study numbers from deleted filenames
    study_numbers_to_restore = []
    for filename in deleted_filenames:
        study_number = filename.replace('.JPG', '')
        study_numbers_to_restore.append(study_number)
    
    print(f"Study numbers to restore: {len(study_numbers_to_restore)}")
    print()
    
    # Query pork_samples to get the sample_id for each study_number
    print("Looking up sample_ids from pork_samples table...")
    restored_count = 0
    already_exists_count = 0
    not_found_count = 0
    errors = []
    
    for study_num in tqdm(study_numbers_to_restore, desc="Restoring records"):
        try:
            # Look up the sample in pork_samples (using standardized_chop_id, not study_number)
            sample_result = supabase.table('pork_samples') \
                .select('id, standardized_chop_id') \
                .eq('standardized_chop_id', study_num) \
                .execute()
            
            if not sample_result.data or len(sample_result.data) == 0:
                not_found_count += 1
                errors.append(f"Study number not found in pork_samples: {study_num}")
                continue
            
            sample_id = sample_result.data[0]['id']
            
            # Check if record already exists
            existing_check = supabase.table('sample_images') \
                .select('id') \
                .eq('sample_id', sample_id) \
                .execute()
            
            if existing_check.data and len(existing_check.data) > 0:
                already_exists_count += 1
                continue
            
            # Insert the record with .JPEG extension
            image_url = f"{R2_PUBLIC_URL}/original/{study_num}.JPEG"
            
            insert_result = supabase.table('sample_images').insert({
                'sample_id': sample_id,
                'image_url': image_url,
                'image_type': 'chop'
            }).execute()
            
            restored_count += 1
            
        except Exception as e:
            errors.append(f"Error restoring {study_num}: {str(e)}")
    
    print()
    print("="*80)
    print("RESTORATION RESULTS:")
    print("="*80)
    print(f"✅ Successfully restored: {restored_count}")
    print(f"⚠️  Already exists: {already_exists_count}")
    print(f"❌ Not found in pork_samples: {not_found_count}")
    print()
    
    if len(errors) > 0:
        print("Errors encountered:")
        for error in errors[:10]:
            print(f"  - {error}")
        if len(errors) > 10:
            print(f"  ... and {len(errors) - 10} more")
        print()
    
    # Verify total count
    verify_result = supabase.table('sample_images') \
        .select('id', count='exact') \
        .execute()
    
    print(f"Total sample_images records after restoration: {verify_result.count}")
    print()
    print("NEXT: Run STEP 3 to update the 316 existing URLs from .JPG to .JPEG")

if __name__ == "__main__":
    try:
        restore_deleted_records()
    except Exception as e:
        print(f"\n❌ Fatal error: {e}")
        import traceback
        traceback.print_exc()
