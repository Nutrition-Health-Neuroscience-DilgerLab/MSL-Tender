import sharp from 'sharp';

interface CropCoordinates {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  confidence: number;
}

/**
 * Detect chop boundaries and remove background
 * Looks for pink/red meat, excludes white paper tags
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
    
    // Create a binary mask for pixels that are NOT blue background
    // This preserves the entire chop including fat and marbling
    const mask = new Uint8Array(width * height);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4; // RGBA format
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        
        // Detect blue background: extremely aggressive detection
        // Catch all shades of blue including very light/dark variants
        const isBlueBackground = 
          b > 80 &&                       // Blue channel (lowered from 90)
          b >= r &&                       // Blue at least as much as red
          b >= g;                         // Blue at least as much as green
        
        // Keep everything that's NOT blue background
        // This includes meat, fat, marbling, and paper tag (we'll filter tag by size)
        if (!isBlueBackground) {
          mask[y * width + x] = 1;
        }
      }
    }
    
    // Apply morphological operations to clean up mask
    // Step 1: Erosion to remove noise and separate tag from chop
    const eroded = new Uint8Array(width * height);
    const kernelSize = 7;
    const kernelRadius = Math.floor(kernelSize / 2);
    
    for (let y = kernelRadius; y < height - kernelRadius; y++) {
      for (let x = kernelRadius; x < width - kernelRadius; x++) {
        let sum = 0;
        for (let ky = -kernelRadius; ky <= kernelRadius; ky++) {
          for (let kx = -kernelRadius; kx <= kernelRadius; kx++) {
            sum += mask[(y + ky) * width + (x + kx)];
          }
        }
        // Require high percentage of neighbors to be chop pixels
        eroded[y * width + x] = sum > (kernelSize * kernelSize * 0.7) ? 1 : 0;
      }
    }
    
    // Step 2: After finding largest component, dilate it to reclaim edge pixels
    const cleaned = eroded;
    
    // Find connected components and keep only the largest one (the chop)
    // This removes the paper tag which is a separate component
    const labels = new Int32Array(width * height);
    let currentLabel = 1;
    const componentSizes = new Map<number, number>();
    
    // Simple flood-fill labeling
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (cleaned[y * width + x] === 1 && labels[y * width + x] === 0) {
          // Start flood fill
          const stack = [[x, y]];
          let componentSize = 0;
          
          while (stack.length > 0) {
            const [cx, cy] = stack.pop()!;
            if (cx < 0 || cx >= width || cy < 0 || cy >= height) continue;
            if (labels[cy * width + cx] !== 0 || cleaned[cy * width + cx] !== 1) continue;
            
            labels[cy * width + cx] = currentLabel;
            componentSize++;
            
            stack.push([cx + 1, cy]);
            stack.push([cx - 1, cy]);
            stack.push([cx, cy + 1]);
            stack.push([cx, cy - 1]);
          }
          
          componentSizes.set(currentLabel, componentSize);
          currentLabel++;
        }
      }
    }
    
    // Find the largest component (should be the chop)
    let largestLabel = 0;
    let largestSize = 0;
    for (const [label, size] of componentSizes) {
      if (size > largestSize) {
        largestSize = size;
        largestLabel = label;
      }
    }
    
    // Require that the largest component is significantly larger than others
    // This helps filter out cases where the tag is picked up
    const secondLargestSize = Math.max(...Array.from(componentSizes.values()).filter(s => s !== largestSize));
    if (largestLabel === 0 || largestSize < secondLargestSize * 3) {
      console.warn(`No clear chop component detected in image: ${imageUrl}`);
      return {
        x1: 0,
        y1: 0,
        x2: 0,
        y2: 0,
        confidence: 0
      };
    }
    
    // Find bounding box of the largest component
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (labels[y * width + x] === largestLabel) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }
    
    // Add minimal margin around detected region - tighter crop
    const marginX = Math.round((maxX - minX) * 0.01);
    const marginY = Math.round((maxY - minY) * 0.01);
    
    const x1 = Math.max(0, minX - marginX);
    const y1 = Math.max(0, minY - marginY);
    const x2 = Math.min(width, maxX + marginX);
    const y2 = Math.min(height, maxY + marginY);
    
    // Calculate confidence
    const chopAreaRatio = largestSize / (width * height);
    const boundingBoxArea = (x2 - x1) * (y2 - y1);
    const fillRatio = boundingBoxArea > 0 ? largestSize / boundingBoxArea : 0;
    
    let confidence = 0.5;
    if (chopAreaRatio > 0.15 && chopAreaRatio < 0.7) confidence += 0.2;
    if (fillRatio > 0.5) confidence += 0.3;
    
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

/**
 * Process image: crop to chop region and remove background
 * Maintains original orientation
 */
export async function processChopImage(imageUrl: string, coords: CropCoordinates): Promise<Buffer> {
  const response = await fetch(imageUrl);
  const imageBuffer = Buffer.from(await response.arrayBuffer());
  
  const image = sharp(imageBuffer);
  const metadata = await image.metadata();
  const width = metadata.width!;
  const height = metadata.height!;
  
  // Get raw pixel data
  const { data } = await image.raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  
  // Create mask for chop pixels (everything that's NOT blue background)
  const mask = new Uint8Array(width * height);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      
      // Same blue background detection as in detectChopBoundaries
      const isBlueBackground = 
        b > 80 &&
        b >= r &&
        b >= g;
      
      // Keep everything that's NOT blue background
      if (!isBlueBackground) {
        mask[y * width + x] = 1;
      }
    }
  }
  
  // Apply morphological cleaning - erosion to separate tag from chop
  const eroded = new Uint8Array(width * height);
  const kernelSize = 7;
  const kernelRadius = Math.floor(kernelSize / 2);
  
  for (let y = kernelRadius; y < height - kernelRadius; y++) {
    for (let x = kernelRadius; x < width - kernelRadius; x++) {
      let sum = 0;
      for (let ky = -kernelRadius; ky <= kernelRadius; ky++) {
        for (let kx = -kernelRadius; kx <= kernelRadius; kx++) {
          sum += mask[(y + ky) * width + (x + kx)];
        }
      }
      eroded[y * width + x] = sum > (kernelSize * kernelSize * 0.7) ? 1 : 0;
    }
  }
  
  const cleaned = eroded;
  
  // Find connected components and keep only the largest
  const labels = new Int32Array(width * height);
  let currentLabel = 1;
  const componentSizes = new Map<number, number>();
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (cleaned[y * width + x] === 1 && labels[y * width + x] === 0) {
        const stack = [[x, y]];
        let componentSize = 0;
        
        while (stack.length > 0) {
          const [cx, cy] = stack.pop()!;
          if (cx < 0 || cx >= width || cy < 0 || cy >= height) continue;
          if (labels[cy * width + cx] !== 0 || cleaned[cy * width + cx] !== 1) continue;
          
          labels[cy * width + cx] = currentLabel;
          componentSize++;
          
          stack.push([cx + 1, cy]);
          stack.push([cx - 1, cy]);
          stack.push([cx, cy + 1]);
          stack.push([cx, cy - 1]);
        }
        
        componentSizes.set(currentLabel, componentSize);
        currentLabel++;
      }
    }
  }
  
  // Find largest component
  let largestLabel = 0;
  let largestSize = 0;
  for (const [label, size] of componentSizes) {
    if (size > largestSize) {
      largestSize = size;
      largestLabel = label;
    }
  }
  
  // Dilate the largest component to reclaim edge pixels
  // This helps remove remaining blue pixels at the boundaries
  const dilated = new Uint8Array(width * height);
  const dilateKernel = 15; // Increased from 10 for even more aggressive edge removal
  const dilateRadius = Math.floor(dilateKernel / 2);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (labels[y * width + x] === largestLabel) {
        // Expand this pixel's influence to neighbors
        for (let dy = -dilateRadius; dy <= dilateRadius; dy++) {
          for (let dx = -dilateRadius; dx <= dilateRadius; dx++) {
            const ny = y + dy;
            const nx = x + dx;
            if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
              dilated[ny * width + nx] = 1;
            }
          }
        }
      }
    }
  }
  
  // Create alpha channel - use dilated mask
  const outputData = Buffer.alloc(width * height * 4);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      
      // Show pixels that belong to the dilated chop mask
      if (dilated[y * width + x] === 1) {
        outputData[idx] = r;
        outputData[idx + 1] = g;
        outputData[idx + 2] = b;
        outputData[idx + 3] = 255; // Opaque
      } else {
        // White background
        outputData[idx] = 255;
        outputData[idx + 1] = 255;
        outputData[idx + 2] = 255;
        outputData[idx + 3] = 255;
      }
    }
  }
  
  // Create image, crop to bounding box, maintain original orientation
  const processed = sharp(outputData, {
    raw: {
      width,
      height,
      channels: 4
    }
  })
  .extract({
    left: coords.x1,
    top: coords.y1,
    width: coords.x2 - coords.x1,
    height: coords.y2 - coords.y1
  });
  
  return processed.jpeg({ quality: 95 }).toBuffer();
}
