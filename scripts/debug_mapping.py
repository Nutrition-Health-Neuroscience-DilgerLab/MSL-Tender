from dotenv import load_dotenv
import os
from supabase import create_client

load_dotenv()
supabase = create_client(
    os.getenv('NEXT_PUBLIC_SUPABASE_URL'),
    os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
)

# Get first 5 samples
samples_resp = supabase.table('pork_samples')\
    .select('id, standardized_chop_id')\
    .order('study_number')\
    .order('standardized_chop_id')\
    .limit(5)\
    .execute()

samples = samples_resp.data
sample_ids = [s['id'] for s in samples]

print("First 5 samples:")
for s in samples:
    print(f"  {s['standardized_chop_id']}: {s['id']}")

# Get images for these samples
images_resp = supabase.table('sample_images')\
    .select('sample_id, image_url')\
    .in_('sample_id', sample_ids)\
    .execute()

images = images_resp.data

print(f"\nFound {len(images)} images for these samples:")
for img in images:
    # Find matching sample
    matching_sample = next((s for s in samples if s['id'] == img['sample_id']), None)
    chop_id = matching_sample['standardized_chop_id'] if matching_sample else 'UNKNOWN'
    filename = img['image_url'].split('/')[-1]
    print(f"  {chop_id} -> {filename}")
