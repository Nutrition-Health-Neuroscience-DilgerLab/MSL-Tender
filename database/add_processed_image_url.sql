-- Add column for processed image URL
ALTER TABLE sample_images
ADD COLUMN processed_image_url TEXT;

-- Add index for faster queries
CREATE INDEX idx_sample_images_processed_url ON sample_images(processed_image_url);

-- Add comment
COMMENT ON COLUMN sample_images.processed_image_url IS 'URL to processed image with background removed and cropped, stored in R2';
