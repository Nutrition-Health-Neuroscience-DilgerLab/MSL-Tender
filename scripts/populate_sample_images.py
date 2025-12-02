"""
Populate sample_images table with R2 URLs
Links pork_samples to their corresponding images in R2
"""
import os
from supabase import create_client, Client
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Supabase configuration
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

# R2 configuration
R2_PUBLIC_URL = "https://pub-54fd27572f2e4efc843722bee98239e0.r2.dev"

# Local images directory to get filenames
IMAGES_DIR = Path("photos_staged_for_upload")

def populate_sample_images():
    """Populate sample_images table with R2 URLs"""
    
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("❌ Error: Missing Supabase credentials")
        print("   Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables")
        print("   Or create a .env file in the project root")
        return
    
    print("🔧 Connecting to Supabase...")
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # Get all pork samples (handle pagination)
    print("📊 Fetching pork samples from database...")
    all_samples = []
    page_size = 1000
    offset = 0
    
    while True:
        response = supabase.table("pork_samples")\
            .select("id, standardized_chop_id")\
            .range(offset, offset + page_size - 1)\
            .execute()
        
        if not response.data:
            break
        
        all_samples.extend(response.data)
        offset += page_size
        
        if len(response.data) < page_size:
            break
    
    samples = all_samples
    print(f"   Found {len(samples)} samples in database")
    
    # Get list of uploaded image filenames
    print("📁 Scanning local images directory...")
    image_files = set()
    for pattern in ['*.JPG', '*.JPEG', '*.jpg', '*.jpeg']:
        for file in IMAGES_DIR.glob(pattern):
            # Remove extension to match standardized_chop_id
            image_files.add(file.stem)
    print(f"   Found {len(image_files)} image files")
    
    # Prepare sample_images records
    print("🔗 Matching samples to images...")
    records = []
    matched = 0
    unmatched = []
    
    for sample in samples:
        sample_id = sample['id']
        chop_id = sample['standardized_chop_id']
        
        # Check if image exists for this sample
        if chop_id in image_files:
            # Determine original extension from filesystem
            original_file = None
            for pattern in ['*.JPG', '*.JPEG', '*.jpg', '*.jpeg']:
                found = list(IMAGES_DIR.glob(f"{chop_id}.*"))
                if found:
                    original_file = found[0]
                    break
            
            if original_file:
                filename = original_file.name
                image_url = f"{R2_PUBLIC_URL}/original/{filename}"
                
                records.append({
                    'sample_id': sample_id,
                    'image_type': 'full',  # All images are full chop images
                    'image_url': image_url,
                    'format': 'jpeg'
                })
                matched += 1
        else:
            unmatched.append(chop_id)
    
    print(f"   ✅ Matched: {matched}")
    if unmatched:
        print(f"   ⚠️  Unmatched: {len(unmatched)} samples without images")
        if len(unmatched) <= 10:
            print(f"      {', '.join(unmatched)}")
    
    if not records:
        print("❌ No records to insert")
        return
    
    # Insert records one at a time to handle duplicates
    print()
    print(f"💾 Inserting {len(records)} records into sample_images table...")
    
    inserted = 0
    skipped = 0
    
    for i, record in enumerate(records, 1):
        try:
            supabase.table("sample_images").insert(record).execute()
            inserted += 1
            if i % 100 == 0 or i == len(records):
                print(f"   Progress: {i}/{len(records)} (inserted: {inserted}, skipped: {skipped})")
        except Exception as e:
            if '23505' in str(e) or 'duplicate key' in str(e).lower():
                skipped += 1
            else:
                print(f"   ⚠️  Error: {e}")
    
    print()
    print("=" * 60)
    print("✅ Successfully populated sample_images table!")
    print(f"   Inserted: {inserted} new image records")
    print(f"   Skipped: {skipped} (already existed)")
    print(f"   Images accessible at: {R2_PUBLIC_URL}/original/[filename]")
    print("=" * 60)

if __name__ == "__main__":
    try:
        populate_sample_images()
    except Exception as e:
        print(f"\n❌ Fatal error: {e}")
        import traceback
        traceback.print_exc()
