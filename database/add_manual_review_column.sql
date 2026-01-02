-- Add manual review flag column to sample_images table
-- This allows admins to flag images that need manual attention

ALTER TABLE sample_images ADD COLUMN IF NOT EXISTS needs_manual_review BOOLEAN DEFAULT false;

COMMENT ON COLUMN sample_images.needs_manual_review IS 'Admin-flagged for manual review (distinct from automated likely_invalid flag)';

-- Create index for fast filtering of flagged images
CREATE INDEX IF NOT EXISTS idx_sample_images_needs_review ON sample_images(needs_manual_review) WHERE needs_manual_review = true;

-- Verify column was added
SELECT 
    column_name, 
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'sample_images' 
  AND column_name = 'needs_manual_review';
