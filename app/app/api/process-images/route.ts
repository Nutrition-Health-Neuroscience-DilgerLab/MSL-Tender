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
    const limit = isTestMode ? 5 : 100
    console.log('[Process Images] Test mode:', isTestMode, 'Limit:', limit)

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
    
    console.log('[Process Images] Executing database query')
    const { data: images, error } = await query
    console.log('[Process Images] Query result:', images?.length, 'images found')
    
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
    console.error('[Process Images] CATCH BLOCK - Error message:', error instanceof Error ? error.message : String(error))
    console.error('[Process Images] CATCH BLOCK - Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    
    return NextResponse.json({ 
      error: 'Failed to process images',
      details: error instanceof Error ? error.message : String(error),
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
