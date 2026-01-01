import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { processChopImage } from '@/lib/chop-detection'

type ImageData = {
  image_url: string
  processed_image_url: string | null
  crop_x1: number
  crop_y1: number
  crop_x2: number
  crop_y2: number
  crop_confidence: number
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Missing image id' }, { status: 400 })
    }

    const supabase = await createClient()

    // Get image data from database
    const { data: image, error } = await supabase
      .from('sample_images')
      .select('image_url, processed_image_url, crop_x1, crop_y1, crop_x2, crop_y2, crop_confidence')
      .eq('id', id)
      .single<ImageData>()

    if (error || !image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    // If we have a processed image URL, redirect to it
    if (image.processed_image_url) {
      return NextResponse.redirect(image.processed_image_url)
    }

    // Fallback: generate on-the-fly if not yet processed
    if (!image.crop_x1 || !image.crop_x2) {
      return NextResponse.json({ error: 'Image not processed yet' }, { status: 400 })
    }

    // Process the image with background removal (fallback)
    const processedBuffer = await processChopImage(image.image_url, {
      x1: image.crop_x1,
      y1: image.crop_y1,
      x2: image.crop_x2,
      y2: image.crop_y2,
      confidence: image.crop_confidence
    })

    // Return the processed image
    return new NextResponse(processedBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=3600',
      },
    })

  } catch (error) {
    console.error('Error processing image:', error)
    return NextResponse.json({ 
      error: 'Failed to process image',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
