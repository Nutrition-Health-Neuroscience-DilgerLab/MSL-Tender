import sharp from 'sharp';

interface CropCoordinates {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  confidence: number;
}

/**
 * Detect chop boundaries in an image using color-based segmentation
 * Looks for pink/red meat against white background
 */
export async function detectChopBoundaries(imageUrl: string): Promise<CropCoordinates> {
  try {
    // Download the image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    
    const imageBuffer = Buffer.from(await response.arrayBuffer());
    
    // Get image metadata
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    const width = metadata.width!;
    const height = metadata.height!;
    
    // Convert to raw RGB pixel data
    const { data } = await image
      .raw()
      .ensureAlpha()
      .toBuffer({ resolveWithObject: true });
    
    // Create a binary mask for pixels that match chop color
    // Chops are typically pink/red (high red, moderate green, low blue)
    const mask = new Uint8Array(width * height);
    let pixelCount = 0;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4; // RGBA format
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        
        // Detect pink/red meat color
        // Red should be significantly higher than blue
        // Red should be higher than green (but not as dramatically)
        const isChopColor = 
          r > 100 &&                    // Has red content
          r > b + 30 &&                 // Red significantly more than blue
          r > g - 20 &&                 // Red slightly more than green
          !(r > 240 && g > 240 && b > 240); // Not white background
        
        if (isChopColor) {
          mask[y * width + x] = 1;
          pixelCount++;
        }
      }
    }
    
    // Find bounding box of all chop pixels
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (mask[y * width + x] === 1) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }
    
    // Check if we found any chop pixels
    if (pixelCount === 0 || minX >= maxX || minY >= maxY) {
      console.warn(`No chop detected in image: ${imageUrl}`);
      // Return null coordinates (will be stored as NULL in database)
      return {
        x1: 0,
        y1: 0,
        x2: 0,
        y2: 0,
        confidence: 0
      };
    }
    
    // Add 5% margin around detected region
    const marginX = Math.round((maxX - minX) * 0.05);
    const marginY = Math.round((maxY - minY) * 0.05);
    
    const x1 = Math.max(0, minX - marginX);
    const y1 = Math.max(0, minY - marginY);
    const x2 = Math.min(width, maxX + marginX);
    const y2 = Math.min(height, maxY + marginY);
    
    // Calculate confidence based on:
    // 1. How much of the image is chop (should be substantial but not everything)
    // 2. Aspect ratio (chops are roughly rectangular)
    const chopAreaRatio = pixelCount / (width * height);
    const boundingBoxArea = (x2 - x1) * (y2 - y1);
    const fillRatio = boundingBoxArea > 0 ? pixelCount / boundingBoxArea : 0;
    
    // Good detection: 10-60% of image is chop, high fill ratio in bounding box
    let confidence = 0.5;
    if (chopAreaRatio > 0.1 && chopAreaRatio < 0.6) confidence += 0.2;
    if (fillRatio > 0.4) confidence += 0.3;
    
    console.log(`Detected chop: (${x1},${y1}) to (${x2},${y2}), confidence: ${confidence.toFixed(2)}`);
    
    return {
      x1,
      y1,
      x2,
      y2,
      confidence: Math.round(confidence * 100) / 100
    };
    
  } catch (error) {
    console.error('Error detecting chop boundaries:', error);
    throw error;
  }
}
