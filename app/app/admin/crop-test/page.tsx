import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

type ProcessedImage = {
  id: number
  image_url: string
  sample_id: number
  crop_x1: number
  crop_y1: number
  crop_x2: number
  crop_y2: number
  crop_confidence: number
  processed_at: string
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
    .select('id, image_url, sample_id, crop_x1, crop_y1, crop_x2, crop_y2, crop_confidence, processed_at')
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {images.map((image) => {
              const croppedUrl = `/api/crop-image?id=${image.id}`
              const confidence = Math.round((image.crop_confidence || 0) * 100)
              
              return (
                <div key={image.id} className="bg-white rounded-lg shadow overflow-hidden">
                  {/* Cropped image */}
                  <div className="aspect-square bg-gray-100 relative">
                    <Image
                      src={croppedUrl}
                      alt={`Sample ${image.sample_id}`}
                      fill
                      className="object-contain"
                      unoptimized
                    />
                    <div className="absolute top-2 left-2 bg-green-500/80 text-white text-xs px-2 py-1 rounded">
                      {confidence}%
                    </div>
                  </div>

                  {/* Full image comparison */}
                  <div className="p-4">
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">
                      Sample ID: {image.sample_id}
                    </h3>
                    
                    <div className="space-y-2 text-xs text-gray-600">
                      <div className="flex justify-between">
                        <span>Crop Region:</span>
                        <span className="font-mono">
                          ({image.crop_x1}, {image.crop_y1}) → ({image.crop_x2}, {image.crop_y2})
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Size:</span>
                        <span>
                          {image.crop_x2 - image.crop_x1} × {image.crop_y2 - image.crop_y1} px
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Confidence:</span>
                        <span className={confidence >= 70 ? 'text-green-600 font-semibold' : confidence >= 50 ? 'text-yellow-600 font-semibold' : 'text-red-600 font-semibold'}>
                          {confidence}%
                        </span>
                      </div>
                    </div>

                    {/* Full image thumbnail */}
                    <details className="mt-4">
                      <summary className="cursor-pointer text-sm text-blue-600 hover:text-blue-700">
                        View original image
                      </summary>
                      <div className="mt-2 aspect-video bg-gray-50 relative rounded overflow-hidden">
                        <Image
                          src={image.image_url}
                          alt={`Full sample ${image.sample_id}`}
                          fill
                          className="object-contain"
                        />
                      </div>
                    </details>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
