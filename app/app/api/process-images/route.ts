import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'

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

    // Check if test mode
    const url = new URL(request.url)
    const isTestMode = url.searchParams.get('test') === 'true'
    const fetchLimit = isTestMode ? 20 : 100 // Fetch more for random selection in test mode
    console.log('[Process Images] Test mode:', isTestMode, 'Fetch limit:', fetchLimit)

    // Get unprocessed images
    const { data: images, error } = await supabase
      .from('sample_images')
      .select('id, image_url, sample_id')
      .eq('crop_processed', false)
      .limit(fetchLimit)
    
    console.log('[Process Images] Query result:', images?.length, 'images found')
    
    if (error) throw error

    if (!images || images.length === 0) {
      return NextResponse.json({ 
        message: 'No unprocessed images found',
        processed: 0 
      })
    }

    // For test mode, randomly select 5 images from the results
    let selectedImages = images
    if (isTestMode && images.length > 5) {
      // Fisher-Yates shuffle and take first 5
      const shuffled = [...images]
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
      }
      selectedImages = shuffled.slice(0, 5)
      console.log('[Process Images] Randomly selected 5 images from', images.length)
    }
    
    if (error) throw error

    if (!images || images.length === 0) {
      return NextResponse.json({ 
        message: 'No unprocessed images found',
        processed: 0 
      })
    }

    // Extract image URLs
    const imageRecords = selectedImages as ImageRecord[]
    const imageUrls = imageRecords.map(img => img.image_url)

    // Call Python script - handle both local and Vercel paths
    const scriptPath = path.join(process.cwd(), '../scripts/chop_detection.py')
    console.log('Script path:', scriptPath)
    console.log('Current working directory:', process.cwd())
    console.log('Processing', imageUrls.length, 'images in', isTestMode ? 'TEST' : 'PRODUCTION', 'mode')
    
    const pythonProcess = spawn('python', [scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    })

    // Send URLs as JSON to stdin
    pythonProcess.stdin.write(JSON.stringify(imageUrls))
    pythonProcess.stdin.end()

    // Collect output
    let output = ''
    let errorOutput = ''

    pythonProcess.stdout.on('data', (data) => {
      output += data.toString()
    })

    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString()
    })

    // Wait for process to complete
    const exitCode = await new Promise((resolve) => {
      pythonProcess.on('close', resolve)
    })

    if (exitCode !== 0) {
      console.error('Python script error:', errorOutput)
      console.error('Python script stdout:', output)
      console.error('Exit code:', exitCode)
      return NextResponse.json({ 
        error: 'Image processing failed',
        details: errorOutput || 'Python script exited with non-zero code',
        exitCode
      }, { status: 500 })
    }

    // Parse results
    let results
    try {
      results = JSON.parse(output)
    } catch (parseError) {
      console.error('Failed to parse Python output:', output)
      console.error('Parse error:', parseError)
      return NextResponse.json({
        error: 'Failed to parse processing results',
        details: 'Python script output was not valid JSON',
        output: output.substring(0, 500)
      }, { status: 500 })
    }

    // Update database with results
    const updates = []
    let successCount = 0

    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      const imageRecord = imageRecords[i]

      if (result.error) {
        console.error(`Failed to process ${result.image_url}: ${result.error}`)
        continue
      }

      // Update sample_images with crop coordinates
      updates.push(
        supabase
          .from('sample_images')
          // @ts-expect-error - Supabase types not updated yet for new columns
          .update({
            crop_x1: result.x1,
            crop_y1: result.y1,
            crop_x2: result.x2,
            crop_y2: result.y2,
            crop_confidence: result.confidence,
            crop_processed: true,
            processed_at: new Date().toISOString()
          })
          .eq('id', imageRecord.id)
      )

      successCount++
    }

    // Execute all updates
    await Promise.all(updates)

    return NextResponse.json({
      message: 'Image processing completed',
      total: imageRecords.length,
      processed: successCount,
      failed: imageRecords.length - successCount
    })

  } catch (error) {
    console.error('[Process Images] CATCH BLOCK - Error type:', typeof error)
    console.error('[Process Images] CATCH BLOCK - Error constructor:', error?.constructor?.name)
    console.error('[Process Images] CATCH BLOCK - Is Error instance:', error instanceof Error)
    console.error('[Process Images] CATCH BLOCK - Error:', error)
    console.error('[Process Images] CATCH BLOCK - Error stringified:', JSON.stringify(error, null, 2))
    console.error('[Process Images] CATCH BLOCK - Error message:', error instanceof Error ? error.message : String(error))
    console.error('[Process Images] CATCH BLOCK - Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    
    // Handle object errors (like from Supabase or spawn)
    let errorDetails = 'Unknown error'
    if (error instanceof Error) {
      errorDetails = error.message
    } else if (typeof error === 'object' && error !== null) {
      errorDetails = JSON.stringify(error, null, 2)
    } else {
      errorDetails = String(error)
    }
    
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
