-- First, let's check the actual column names in the sample_images table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'sample_images'
ORDER BY ordinal_position;
