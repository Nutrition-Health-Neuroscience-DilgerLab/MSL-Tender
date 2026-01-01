-- Add crop coordinate columns to sample_images table
-- Run this migration in Supabase SQL Editor

ALTER TABLE sample_images 
ADD COLUMN IF NOT EXISTS crop_x1 INTEGER,
ADD COLUMN IF NOT EXISTS crop_y1 INTEGER,
ADD COLUMN IF NOT EXISTS crop_x2 INTEGER,
ADD COLUMN IF NOT EXISTS crop_y2 INTEGER,
ADD COLUMN IF NOT EXISTS crop_processed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS crop_confidence DECIMAL(3,2),
ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP WITH TIME ZONE;

-- Add index for quickly finding unprocessed images
CREATE INDEX IF NOT EXISTS idx_sample_images_crop_processed 
ON sample_images(crop_processed) 
WHERE crop_processed = FALSE;

-- Add comment
COMMENT ON COLUMN sample_images.crop_x1 IS 'Left boundary of detected chop (pixels)';
COMMENT ON COLUMN sample_images.crop_y1 IS 'Top boundary of detected chop (pixels)';
COMMENT ON COLUMN sample_images.crop_x2 IS 'Right boundary of detected chop (pixels)';
COMMENT ON COLUMN sample_images.crop_y2 IS 'Bottom boundary of detected chop (pixels)';
COMMENT ON COLUMN sample_images.crop_processed IS 'Whether ML chop detection has been run';
COMMENT ON COLUMN sample_images.crop_confidence IS 'ML model confidence score (0.00-1.00)';
