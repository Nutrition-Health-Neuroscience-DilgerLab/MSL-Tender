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
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if test mode
    const url = new URL(request.url)
    const isTestMode = url.searchParams.get('test') === 'true'
    const limit = isTestMode ? 5 : 100

    // Get unprocessed images
    let query = supabase
      .from('sample_images')
      .select('id, image_url, sample_id')
      .eq('crop_processed', false)
      .limit(limit)
    
    // For test mode, randomize the selection
    if (isTestMode) {
      // Get random sample by ordering randomly (PostgreSQL-specific)
      query = query.order('random()', { ascending: true })
    }
    
    const { data: images, error } = await query
    
    if (error) throw error

    if (!images || images.length === 0) {
      return NextResponse.json({ 
        message: 'No unprocessed images found',
        processed: 0 
      })
    }

    // Extract image URLs
    const imageRecords = images as ImageRecord[]
    const imageUrls = imageRecords.map(img => img.image_url)

    // Call Python script
    const scriptPath = path.join(process.cwd(), '../scripts/chop_detection.py')
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
      return NextResponse.json({ 
        error: 'Image processing failed',
        details: errorOutput
      }, { status: 500 })
    }

    // Parse results
    const results = JSON.parse(output)

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
    console.error('Error processing images:', error)
    return NextResponse.json({ 
      error: 'Failed to process images',
      details: error instanceof Error ? error.message : 'Unknown error'
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
