-- Fix the typo in R2 URLs (8433722 -> 843722)
UPDATE sample_images
SET image_url = REPLACE(image_url, 'pub-54fd27572f2e4efc8433722bee98239e0.r2.dev', 'pub-54fd27572f2e4efc843722bee98239e0.r2.dev')
WHERE image_url LIKE '%pub-54fd27572f2e4efc8433722bee98239e0.r2.dev%';

-- Verify the fix
SELECT COUNT(*) as fixed_count 
FROM sample_images 
WHERE image_url LIKE '%pub-54fd27572f2e4efc843722bee98239e0.r2.dev%';

SELECT COUNT(*) as remaining_bad_urls
FROM sample_images 
WHERE image_url LIKE '%pub-54fd27572f2e4efc8433722bee98239e0.r2.dev%';
