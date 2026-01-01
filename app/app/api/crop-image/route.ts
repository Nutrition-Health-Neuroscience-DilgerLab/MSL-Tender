import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import sharp from 'sharp'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const x1 = parseInt(searchParams.get('x1') || '0')
    const y1 = parseInt(searchParams.get('y1') || '0')
    const x2 = parseInt(searchParams.get('x2') || '0')
    const y2 = parseInt(searchParams.get('y2') || '0')

    if (!id || !x1 || !x2 || !y1 || !y2) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    const supabase = await createClient()

    // Get image URL from database
    const { data: image, error } = await supabase
      .from('sample_images')
      .select('image_url')
      .eq('id', id)
      .single()

    if (error || !image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    // Download the image
    const imageResponse = await fetch(image.image_url)
    if (!imageResponse.ok) {
      return NextResponse.json({ error: 'Failed to fetch image' }, { status: 500 })
    }

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer())

    // Crop the image using sharp
    const width = x2 - x1
    const height = y2 - y1

    const croppedBuffer = await sharp(imageBuffer)
      .extract({
        left: x1,
        top: y1,
        width: width,
        height: height
      })
      .jpeg({ quality: 90 })
      .toBuffer()

    // Return the cropped image
    return new NextResponse(croppedBuffer, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })

  } catch (error) {
    console.error('Error cropping image:', error)
    return NextResponse.json({ 
      error: 'Failed to crop image',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
