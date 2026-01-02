-- Add enhanced metrics columns to sample_images table
-- Run this in Supabase SQL Editor before processing images with enhanced metrics

-- Add dimension columns
ALTER TABLE sample_images ADD COLUMN IF NOT EXISTS crop_width INTEGER;
ALTER TABLE sample_images ADD COLUMN IF NOT EXISTS crop_height INTEGER;
ALTER TABLE sample_images ADD COLUMN IF NOT EXISTS aspect_ratio DECIMAL(5,2);

-- Add color analysis columns
ALTER TABLE sample_images ADD COLUMN IF NOT EXISTS has_meat_tones BOOLEAN DEFAULT false;
ALTER TABLE sample_images ADD COLUMN IF NOT EXISTS avg_saturation DECIMAL(4,3);
ALTER TABLE sample_images ADD COLUMN IF NOT EXISTS is_grayscale BOOLEAN DEFAULT false;

-- Add text pattern columns
ALTER TABLE sample_images ADD COLUMN IF NOT EXISTS has_sequential_numbers BOOLEAN DEFAULT false;

-- Add validity flag columns
ALTER TABLE sample_images ADD COLUMN IF NOT EXISTS likely_ruler BOOLEAN DEFAULT false;
ALTER TABLE sample_images ADD COLUMN IF NOT EXISTS likely_tag BOOLEAN DEFAULT false;
ALTER TABLE sample_images ADD COLUMN IF NOT EXISTS likely_invalid BOOLEAN DEFAULT false;

-- Add comments for documentation
COMMENT ON COLUMN sample_images.crop_width IS 'Width of cropped region in pixels';
COMMENT ON COLUMN sample_images.crop_height IS 'Height of cropped region in pixels';
COMMENT ON COLUMN sample_images.aspect_ratio IS 'Aspect ratio (max/min dimension) - rulers typically > 4.0';
COMMENT ON COLUMN sample_images.has_meat_tones IS 'True if pink/red meat colors detected (hue 0-30° or 330-360°)';
COMMENT ON COLUMN sample_images.avg_saturation IS 'Average color saturation 0-1 (low values indicate grayscale)';
COMMENT ON COLUMN sample_images.is_grayscale IS 'True if mostly grayscale (avg saturation < 0.15)';
COMMENT ON COLUMN sample_images.has_sequential_numbers IS 'True if OCR detected sequential numbers (ruler pattern)';
COMMENT ON COLUMN sample_images.likely_ruler IS 'True if extreme aspect ratio + grayscale + sequential numbers';
COMMENT ON COLUMN sample_images.likely_tag IS 'True if small size or has alphanumeric study ID pattern';
COMMENT ON COLUMN sample_images.likely_invalid IS 'True if flagged as ruler, tag, or missing meat tones';

-- Create index on likely_invalid for faster filtering
CREATE INDEX IF NOT EXISTS idx_sample_images_likely_invalid ON sample_images(likely_invalid) WHERE likely_invalid = true;

-- Create index on aspect_ratio for ruler detection queries
CREATE INDEX IF NOT EXISTS idx_sample_images_aspect_ratio ON sample_images(aspect_ratio) WHERE aspect_ratio > 4.0;

-- Verify columns were added
SELECT 
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'sample_images' 
  AND column_name IN (
    'crop_width', 'crop_height', 'aspect_ratio',
    'has_meat_tones', 'avg_saturation', 'is_grayscale',
    'has_sequential_numbers', 'likely_ruler', 'likely_tag', 'likely_invalid'
  )
ORDER BY column_name;
