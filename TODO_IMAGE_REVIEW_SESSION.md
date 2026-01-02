# Image Review & Correction TODO List

**Session Goal**: Manually review all 1,490 processed images, flag problematic ones, and establish workflow for corrections.

---

## Phase 1: Manual Review & Flagging (Current Session)

### ✅ COMPLETED (January 1, 2026)
- [x] Deploy manual review flag system to production
- [x] Add `needs_manual_review` column to database
- [x] Create "Flag for Review" button in crop-test UI
- [x] Fix bool serialization bug in Colab notebook
- [x] Run second backfill batch (~490 images) to complete enhanced metrics for all 1,490 images

### 🎯 NEXT: Review All Images
1. **Browse** https://msl-tender.vercel.app/admin/crop-test
2. **Flag problematic images** by clicking "Flag for Review" when you see:
   - Rulers included in the crop
   - Paper tags included in the crop
   - Multiple chops in one crop
   - Chop cut off or poorly framed
   - Background artifacts
3. **Take notes** on common issues you see (helps decide fix strategy)

**Estimated Time**: 1-2 hours for 1,490 images (2-4 seconds per image)

---

## Phase 2: Export & Analyze Flagged Images

### Query Flagged Images
Run this in Supabase SQL Editor to get full report:

```sql
-- Get all flagged images with enhanced metrics
SELECT 
    id,
    image_url,
    processed_image_url,
    crop_confidence,
    aspect_ratio,
    likely_ruler,
    likely_tag,
    likely_invalid,
    has_meat_tones,
    is_grayscale,
    has_sequential_numbers
FROM sample_images 
WHERE needs_manual_review = true
ORDER BY likely_invalid DESC, crop_confidence ASC;
```

### Export to CSV
```sql
-- Export for offline analysis
COPY (
    SELECT 
        id,
        image_url,
        likely_ruler,
        likely_tag,
        crop_confidence
    FROM sample_images 
    WHERE needs_manual_review = true
) TO STDOUT WITH CSV HEADER;
```

Save as `flagged_images_for_review.csv`

### Categorize Flagged Images
Create three lists:
1. **Fix in Photoshop** - Good chops with removable rulers/tags
2. **Delete Entirely** - Pure rulers/tags with no usable chop
3. **Reprocess with Different Settings** - Might work with adjusted crop parameters

---

## Phase 3: Fix Images in Photoshop

### Setup
- [ ] Create folder: `C:\Users\rndpi\Documents\MSL-Tender-Fixes\originals\`
- [ ] Create folder: `C:\Users\rndpi\Documents\MSL-Tender-Fixes\edited\`
- [ ] Download all flagged originals from R2 (use `image_url` column)

### Download Script (Optional)
Create `scripts/download_flagged_images.py`:

```python
# Downloads all flagged images for editing
import os
import requests
from supabase import create_client

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

response = supabase.table('sample_images') \
    .select('id, image_url') \
    .eq('needs_manual_review', True) \
    .execute()

download_dir = "C:/Users/rndpi/Documents/MSL-Tender-Fixes/originals"
os.makedirs(download_dir, exist_ok=True)

for record in response.data:
    filename = record['image_url'].split('/')[-1]
    filepath = os.path.join(download_dir, filename)
    
    print(f"Downloading {filename}...")
    r = requests.get(record['image_url'])
    with open(filepath, 'wb') as f:
        f.write(r.content)

print(f"✓ Downloaded {len(response.data)} images")
```

### Photoshop Workflow
For each flagged image:
1. Open in Photoshop
2. Use **Clone Stamp** or **Content-Aware Fill** to remove rulers/tags
3. Crop to focus on chop if needed
4. Save as `.jpg` with **same filename** as original
5. Export to `edited/` folder

**Photoshop Batch Action** (optional):
- Record action for common edits
- Apply to multiple images at once

---

## Phase 4: Re-upload Fixed Images to R2

### Manual Upload (Small Batch)
1. Log into Cloudflare Dashboard
2. Navigate to R2 bucket: `msl-pork-chops`
3. Upload to `original/` folder - **will overwrite existing files**
4. Verify upload successful

### Script Upload (Large Batch)
Create `scripts/reupload_fixed_images.py`:

```python
# Uploads edited images back to R2 original/ folder
import os
import boto3
from botocore.config import Config

r2 = boto3.client(
    's3',
    endpoint_url=f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
    aws_access_key_id=R2_ACCESS_KEY_ID,
    aws_secret_access_key=R2_SECRET_ACCESS_KEY,
    config=Config(signature_version='s3v4'),
    region_name='auto'
)

edited_dir = "C:/Users/rndpi/Documents/MSL-Tender-Fixes/edited"

for filename in os.listdir(edited_dir):
    if filename.endswith('.jpg'):
        filepath = os.path.join(edited_dir, filename)
        key = f"original/{filename}"
        
        print(f"Uploading {filename} to R2...")
        
        with open(filepath, 'rb') as f:
            r2.put_object(
                Bucket=R2_BUCKET_NAME,
                Key=key,
                Body=f.read(),
                ContentType='image/jpeg',
                CacheControl='public, max-age=31536000, immutable'
            )
        
        print(f"✓ Uploaded {filename}")

print("✓ All fixed images uploaded to R2")
```

---

## Phase 5: Mark for Reprocessing

### Reset Flagged Images for Reprocessing
Run in Supabase SQL Editor:

```sql
-- Mark all flagged images as unprocessed
UPDATE sample_images
SET 
    crop_processed = false,
    processed_image_url = NULL,
    crop_x1 = NULL,
    crop_y1 = NULL,
    crop_x2 = NULL,
    crop_y2 = NULL,
    crop_confidence = NULL,
    processed_at = NULL
WHERE needs_manual_review = true;

-- Verify count
SELECT COUNT(*) as images_marked_for_reprocessing
FROM sample_images
WHERE needs_manual_review = true AND crop_processed = false;
```

---

## Phase 6: Reprocess Fixed Images

### Option A: Reprocess Only Flagged Images
In Colab notebook, create new cell:

```python
# Process only images flagged for manual review
response = supabase.table('sample_images') \
    .select('id, image_url') \
    .eq('needs_manual_review', True) \
    .eq('crop_processed', False) \
    .execute()

images_to_process = response.data
print(f"Found {len(images_to_process)} flagged images to reprocess")

# Use same processing loop as main batch
results = {'success': 0, 'failed': 0, 'errors': []}

for img_data in tqdm(images_to_process, desc="Reprocessing flagged images"):
    try:
        original = download_image(img_data['image_url'])
        processed, metadata = process_image_with_rembg(original)
        
        if processed is None:
            results['failed'] += 1
            continue
        
        study_number = extract_study_number_from_url(img_data['image_url'])
        processed_url = upload_to_r2(processed, study_number, study_number + '.jpg')
        update_database(img_data['id'], processed_url, metadata)
        
        results['success'] += 1
        
    except Exception as e:
        results['failed'] += 1
        results['errors'].append({'id': img_data['id'], 'error': str(e)})

print(f"✓ Reprocessed: {results['success']} succeeded, {results['failed']} failed")
```

### Option B: Full Reprocessing Run
- Run Cell 13 (process all unprocessed) - will automatically pick up flagged images

---

## Phase 7: Review Results & Unflag

### Check Reprocessed Results
1. Browse https://msl-tender.vercel.app/admin/crop-test
2. Filter to only flagged images (orange rings)
3. Review each reprocessed image
4. If fixed correctly, **click button again to unflag** (removes orange ring)
5. If still problematic, keep flagged for another round

### Query Remaining Issues
```sql
-- Images still flagged after reprocessing
SELECT 
    id,
    image_url,
    processed_image_url,
    crop_confidence
FROM sample_images
WHERE needs_manual_review = true
ORDER BY crop_confidence ASC;
```

---

## Phase 8: Handle Unfixable Images

### Delete Invalid Records
For images that are truly unusable (pure rulers, no chop visible, etc.):

```sql
-- Preview before deleting
SELECT id, image_url, likely_ruler, likely_tag
FROM sample_images
WHERE needs_manual_review = true 
  AND likely_invalid = true
  AND crop_confidence < 0.15;

-- Delete if confirmed unusable
DELETE FROM sample_images
WHERE id IN (
    -- List specific IDs after manual review
    '12345678-1234-1234-1234-123456789012',
    '23456789-2345-2345-2345-234567890123'
);
```

### Update R2 Cleanup (Optional)
Remove deleted images from R2 to save storage:

```python
# Delete R2 files for deleted database records
deleted_image_ids = ['id1', 'id2', 'id3']  # From SQL query

for img_id in deleted_image_ids:
    # Get filename from database before deletion
    # Then delete from R2
    r2.delete_object(Bucket=R2_BUCKET_NAME, Key=f"original/{filename}")
    r2.delete_object(Bucket=R2_BUCKET_NAME, Key=f"processed/{filename}")
```

---

## Alternative: Adjust Processing Parameters Instead

### For images where rembg failed but chop is salvageable:
Instead of manual Photoshop editing, try adjusting Colab processing:

1. **Increase erosion iterations** (currently 1, try 2-3)
2. **Adjust blue edge detection threshold** (currently `> cropped_rgb + 20`)
3. **Stricter component size filtering** (reject if too small/large)
4. **Manual crop coordinates** (for specific problem images)

Create Cell for Manual Crop Override:

```python
# Manual crop override for specific images
manual_crops = {
    'image_id_1': {'x1': 100, 'y1': 150, 'x2': 800, 'y2': 900},
    'image_id_2': {'x1': 200, 'y1': 100, 'x2': 750, 'y2': 850},
}

for img_id, coords in manual_crops.items():
    # Download, crop using coords, upload, update DB
    pass
```

---

## Phase 9: Final Verification

### Statistics
```sql
-- Final counts
SELECT 
    COUNT(*) as total_images,
    SUM(CASE WHEN crop_processed THEN 1 ELSE 0 END) as processed,
    SUM(CASE WHEN needs_manual_review THEN 1 ELSE 0 END) as still_flagged,
    SUM(CASE WHEN likely_invalid THEN 1 ELSE 0 END) as likely_invalid,
    AVG(crop_confidence) as avg_confidence
FROM sample_images
WHERE image_url IS NOT NULL;
```

### Quality Check
```sql
-- Low confidence images that weren't flagged (spot check)
SELECT id, image_url, processed_image_url, crop_confidence
FROM sample_images
WHERE crop_processed = true
  AND needs_manual_review = false
  AND crop_confidence < 0.50
ORDER BY crop_confidence ASC
LIMIT 20;
```

### Export Final Dataset
Once satisfied with all images:

```sql
-- Export clean dataset
SELECT 
    id,
    image_url,
    processed_image_url,
    crop_confidence,
    aspect_ratio,
    has_meat_tones,
    likely_invalid,
    needs_manual_review
FROM sample_images
WHERE crop_processed = true
  AND needs_manual_review = false
ORDER BY crop_confidence DESC;
```

---

## Success Criteria

- [ ] All 1,490 images reviewed
- [ ] Flagged images < 5% of total (< 75 images)
- [ ] Average crop confidence > 0.85
- [ ] Zero images with `likely_ruler = true` that aren't flagged
- [ ] All flagged images either fixed or documented as "unfixable"

---

## Notes & Observations

**Common Issues Found** (fill in during review):
- 
- 
- 

**Images to Delete** (pure rulers/tags):
- 
- 

**Images Fixed in Photoshop**:
- 
- 

**Adjustment Ideas for Future Runs**:
- 
- 

---

## Estimated Time Breakdown

| Phase | Task | Est. Time |
|-------|------|-----------|
| 1 | Review & flag all images | 1-2 hours |
| 2 | Export & categorize | 15 min |
| 3 | Photoshop editing | 30-60 min (depends on count) |
| 4 | Re-upload to R2 | 10 min |
| 5 | Mark for reprocessing | 5 min |
| 6 | Reprocess in Colab | 10-20 min |
| 7 | Review results | 30 min |
| 8 | Handle unfixable | 15 min |
| 9 | Final verification | 10 min |
| **TOTAL** | | **3-5 hours** |

---

**Last Updated**: January 1, 2026  
**Status**: Ready for Phase 1 (Manual Review)
