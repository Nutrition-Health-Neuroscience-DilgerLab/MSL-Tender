-- STEP 3: Count records after deletion
-- Run this after executing delete_orphaned_records.sql to verify results

SELECT 
    'Total records (AFTER)' as metric,
    COUNT(*) as count
FROM sample_images

UNION ALL

SELECT 
    'Records with image URLs (AFTER)' as metric,
    COUNT(*) as count
FROM sample_images
WHERE image_url IS NOT NULL

UNION ALL

SELECT 
    'Records WITHOUT image URLs (AFTER)' as metric,
    COUNT(*) as count
FROM sample_images
WHERE image_url IS NULL

UNION ALL

SELECT 
    'Already processed (AFTER)' as metric,
    COUNT(*) as count
FROM sample_images
WHERE crop_processed = true AND image_url IS NOT NULL

UNION ALL

SELECT 
    'Awaiting processing (AFTER)' as metric,
    COUNT(*) as count
FROM sample_images
WHERE (crop_processed IS NULL OR crop_processed = false) AND image_url IS NOT NULL;

-- Expected results:
-- Total records (AFTER): ~1,557 (was 1,751 - 194 deleted)
-- Records with image URLs: ~1,490 (unchanged - these all have images)
-- Already processed: ~1,000 (unchanged - your first Colab run)
-- Awaiting processing: ~490 (unchanged - remaining to process)
