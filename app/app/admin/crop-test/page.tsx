import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ImageGrid from './ImageGrid'

type ProcessedImage = {
  id: number
  image_url: string
  processed_image_url: string | null
  sample_id: number
  crop_x1: number
  crop_y1: number
  crop_x2: number
  crop_y2: number
  crop_confidence: number
  processed_at: string
  needs_manual_review: boolean | null
}

export default async function CropTestPage() {
  const supabase = await createClient()

  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/admin/login')
  }

  // Get all images that have been cropped
  const { data: images } = await supabase
    .from('sample_images')
    .select('id, image_url, processed_image_url, sample_id, crop_x1, crop_y1, crop_x2, crop_y2, crop_confidence, processed_at, needs_manual_review')
    .eq('crop_processed', true)
    .not('crop_x1', 'is', null)
    .order('processed_at', { ascending: false })
    .returns<ProcessedImage[]>()

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Cropped Images</h1>
              <p className="text-sm text-gray-600 mt-1">
                {images?.length || 0} total cropped images
              </p>
            </div>
            <Link
              href="/admin/dashboard"
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!images || images.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600">No cropped images found. Run the crop process from the dashboard first.</p>
          </div>
        ) : (
          <ImageGrid images={images} />
        )}
      </main>
    </div>
  )
}
