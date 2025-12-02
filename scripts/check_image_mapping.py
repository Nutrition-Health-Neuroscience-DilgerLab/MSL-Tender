from dotenv import load_dotenv
import os
from supabase import create_client

load_dotenv()
supabase = create_client(
    os.getenv('NEXT_PUBLIC_SUPABASE_URL'),
    os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
)

# Get first 3 samples
samples = supabase.table('pork_samples').select('id, standardized_chop_id').limit(3).execute()
print('Sample IDs:')
for s in samples.data:
    print(f"{s['standardized_chop_id']}: {s['id']}")

# Get first 3 images
images = supabase.table('sample_images').select('sample_id, image_url, filename').limit(3).execute()
print('\nImage records:')
for img in images.data:
    print(f"sample_id: {img['sample_id']}")
    print(f"filename: {img['filename']}")
    print(f"url: {img['image_url']}")
    print()
