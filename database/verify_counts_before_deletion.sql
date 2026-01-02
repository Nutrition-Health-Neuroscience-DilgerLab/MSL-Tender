-- STEP 1: Count records before deletion
-- Run this first to verify current state

SELECT 
    'Total records' as metric,
    COUNT(*) as count
FROM sample_images

UNION ALL

SELECT 
    'Records with image URLs' as metric,
    COUNT(*) as count
FROM sample_images
WHERE image_url IS NOT NULL

UNION ALL

SELECT 
    'Records WITHOUT image URLs' as metric,
    COUNT(*) as count
FROM sample_images
WHERE image_url IS NULL

UNION ALL

SELECT 
    'Already processed' as metric,
    COUNT(*) as count
FROM sample_images
WHERE crop_processed = true AND image_url IS NOT NULL

UNION ALL

SELECT 
    'Awaiting processing' as metric,
    COUNT(*) as count
FROM sample_images
WHERE (crop_processed IS NULL OR crop_processed = false) AND image_url IS NOT NULL;
