import { createClient } from '@/lib/supabase/server'
import Image from 'next/image'
import Link from 'next/link'

type Sample = {
  id: string
  study_number: number
  standardized_chop_id: string
  chop_color: number | null
  chop_marbling: number | null
  chop_firmness: number | null
  ph: number | null
}

export default async function SamplesPage() {
  const supabase = await createClient()

  // Get all samples with pagination
  const { data: samples, error } = await supabase
    .from('pork_samples')
    .select('id, study_number, standardized_chop_id, chop_color, chop_marbling, chop_firmness, ph')
    .order('study_number', { ascending: true })
    .order('standardized_chop_id', { ascending: true })
    .limit(50)
    .returns<Sample[]>()

  if (error) {
    console.error('Error fetching samples:', error)
  }

  // Get images for these samples
  const sampleIds = samples?.map(s => s.id) || []
  const { data: images } = await supabase
    .from('sample_images')
    .select('sample_id, image_url')
    .in('sample_id', sampleIds)

  // Create a map of sample_id to image_url
  const imageMap = new Map(
    (images as Array<{ sample_id: string; image_url: string }> | null)?.map(img => [img.sample_id, img.image_url]) || []
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <Link href="/admin/dashboard" className="text-sm text-green-600 hover:text-green-700 mb-2 inline-block">
                ← Back to Dashboard
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">Sample Library</h1>
              <p className="text-sm text-gray-600 mt-1">
                Showing 50 of {samples?.length || 0} samples
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Samples Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {samples?.map((sample) => {
            const imageUrl = imageMap.get(sample.id)
            
            return (
              <div key={sample.id} className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                {/* Image */}
                <div className="relative h-48 bg-gray-100">
                  {imageUrl ? (
                    <Image
                      src={imageUrl}
                      alt={sample.standardized_chop_id}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400">
                      No image
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">
                    {sample.standardized_chop_id}
                  </h3>
                  
                  <div className="space-y-1 text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span>Study:</span>
                      <span className="font-medium">{sample.study_number}</span>
                    </div>
                    
                    {sample.chop_color && (
                      <div className="flex justify-between">
                        <span>Color:</span>
                        <span className="font-medium">{sample.chop_color}</span>
                      </div>
                    )}
                    
                    {sample.chop_marbling && (
                      <div className="flex justify-between">
                        <span>Marbling:</span>
                        <span className="font-medium">{sample.chop_marbling}</span>
                      </div>
                    )}
                    
                    {sample.chop_firmness && (
                      <div className="flex justify-between">
                        <span>Firmness:</span>
                        <span className="font-medium">{sample.chop_firmness}</span>
                      </div>
                    )}
                    
                    {sample.ph && (
                      <div className="flex justify-between">
                        <span>pH:</span>
                        <span className="font-medium">{sample.ph.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Pagination notice */}
        <div className="mt-8 text-center text-gray-600">
          <p>Showing first 50 samples. Full pagination coming soon.</p>
        </div>
      </main>
    </div>
  )
}
