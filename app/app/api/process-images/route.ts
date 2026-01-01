import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { detectChopBoundaries, processChopImage } from '@/lib/chop-detection'
import { uploadProcessedImage } from '@/lib/r2'

interface ImageRecord {
  id: number
  image_url: string
  sample_id: number
}

export async function POST(request: Request) {
  console.log('[Process Images] Starting request')
  try {
    const supabase = await createClient()
    console.log('[Process Images] Supabase client created')

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    console.log('[Process Images] User check:', user ? `User ${user.id}` : 'No user')
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if test mode or reprocess mode
    const url = new URL(request.url)
    const isTestMode = url.searchParams.get('test') === 'true'
    const isReprocess = url.searchParams.get('reprocess') === 'true'
    const fetchLimit = isTestMode ? 20 : 100
    console.log('[Process Images] Test mode:', isTestMode, 'Reprocess:', isReprocess, 'Fetch limit:', fetchLimit)

    // Get images based on mode
    let query = supabase
      .from('sample_images')
      .select('id, image_url, sample_id')
    
    if (!isReprocess) {
      // Normal mode: only unprocessed images
      query = query.eq('crop_processed', false)
    } else if (isTestMode && isReprocess) {
      // Reprocess mode with test: get already processed images
      query = query.eq('crop_processed', true).limit(10)
    }
    
    query = query.limit(fetchLimit)
    
    const { data: images, error } = await query
    if (error) throw error

    if (!images || images.length === 0) {
      return NextResponse.json({ 
        message: isReprocess ? 'No processed images to reprocess' : 'No unprocessed images found',
        processed: 0 
      })
    }

    // For test mode, randomly select 5 images from the results
    let selectedImages = images
    if (isTestMode && images.length > 5 && !isReprocess) {
      // Fisher-Yates shuffle and take first 5
      const shuffled = [...images]
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
      }
      selectedImages = shuffled.slice(0, 5)
      console.log('[Process Images] Randomly selected 5 images from', images.length)
    }

    // Extract image URLs
    const imageRecords = selectedImages as ImageRecord[]
    console.log('[Process Images] Processing', imageRecords.length, 'images')

    // Process images using Node.js detection
    const results = []
    let successCount = 0

    for (const imageRecord of imageRecords) {
      try {
        console.log(`[Process Images] Processing image ${imageRecord.id}: ${imageRecord.image_url}`)
        
        // Detect chop boundaries
        const coordinates = await detectChopBoundaries(imageRecord.image_url)
        
        if (coordinates.confidence === 0) {
          console.warn(`[Process Images] No chop detected in image ${imageRecord.id}`)
          results.push({
            id: imageRecord.id,
            image_url: imageRecord.image_url,
            error: 'No chop detected'
          })
          continue
        }
        
        // Process image (crop and remove background)
        const processedBuffer = await processChopImage(imageRecord.image_url, coordinates)
        
        // Extract study number and filename from original URL
        // URL format: https://...r2.dev/original/20-04/image.jpg
        const urlParts = imageRecord.image_url.split('/')
        // Find the study number (folder after 'original')
        const originalIndex = urlParts.findIndex(part => part === 'original')
        const studyNumber = originalIndex >= 0 ? urlParts[originalIndex + 1] : urlParts[urlParts.length - 2]
        const filename = urlParts[urlParts.length - 1]
        
        console.log(`[Process Images] Extracted path - study: ${studyNumber}, file: ${filename}`)
        
        // Upload processed image to R2
        const { url: processedUrl } = await uploadProcessedImage(
          processedBuffer,
          studyNumber,
          filename
        )
        
        console.log(`[Process Images] Uploaded processed image to ${processedUrl}`)
        
        // Update sample_images with crop coordinates and processed URL
        const { error: updateError } = await supabase
          .from('sample_images')
          // @ts-expect-error - Supabase types not updated yet for new columns
          .update({
            crop_x1: coordinates.x1,
            crop_y1: coordinates.y1,
            crop_x2: coordinates.x2,
            crop_y2: coordinates.y2,
            crop_confidence: coordinates.confidence,
            crop_processed: true,
            processed_at: new Date().toISOString(),
            processed_image_url: processedUrl
          })
          .eq('id', imageRecord.id)

        if (updateError) {
          console.error(`Failed to update image ${imageRecord.id}:`, updateError)
        } else {
          successCount++
          console.log(`[Process Images] Successfully processed image ${imageRecord.id}`)
        }

        results.push({
          id: imageRecord.id,
          image_url: imageRecord.image_url,
          processed_url: processedUrl,
          ...coordinates
        })
      } catch (error) {
        console.error(`Error processing image ${imageRecord.id}:`, error)
        results.push({
          id: imageRecord.id,
          image_url: imageRecord.image_url,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    console.log('[Process Images] Completed:', successCount, 'out of', imageRecords.length)

    return NextResponse.json({
      message: `Successfully processed ${successCount} of ${imageRecords.length} images`,
      total: imageRecords.length,
      processed: successCount,
      failed: imageRecords.length - successCount,
      results
    })

  } catch (error) {
    console.error('[Process Images] Error:', error)
    const errorDetails = error instanceof Error ? error.message : String(error)
    
    return NextResponse.json({ 
      error: 'Failed to process images',
      details: errorDetails,
      errorType: error?.constructor?.name || typeof error,
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}

// Get processing status
export async function GET() {
  try {
    const supabase = await createClient()

    const { count: totalImages } = await supabase
      .from('sample_images')
      .select('id', { count: 'exact', head: true })

    const { count: processedImages } = await supabase
      .from('sample_images')
      .select('id', { count: 'exact', head: true })
      .eq('crop_processed', true)

    return NextResponse.json({
      total: totalImages || 0,
      processed: processedImages || 0,
      remaining: (totalImages || 0) - (processedImages || 0)
    })
  } catch (error) {
    console.error('Error getting processing status:', error)
    return NextResponse.json({ error: 'Failed to get status' }, { status: 500 })
  }
}
