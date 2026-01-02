'use client'

import { useState } from 'react'
import Image from 'next/image'

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

type ImageGridProps = {
  images: ProcessedImage[]
}

export default function ImageGrid({ images }: ImageGridProps) {
  const [reviewFlags, setReviewFlags] = useState<Record<number, boolean>>(
    Object.fromEntries(images.map(img => [img.id, img.needs_manual_review ?? false]))
  )
  const [loading, setLoading] = useState<Record<number, boolean>>({})

  const toggleReview = async (imageId: number) => {
    const currentFlag = reviewFlags[imageId]
    const newFlag = !currentFlag

    // Optimistic update
    setReviewFlags(prev => ({ ...prev, [imageId]: newFlag }))
    setLoading(prev => ({ ...prev, [imageId]: true }))

    try {
      const response = await fetch('/api/toggle-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId, needsReview: newFlag })
      })

      if (!response.ok) {
        throw new Error('Failed to update review flag')
      }
    } catch (error) {
      console.error('Error toggling review flag:', error)
      // Revert on error
      setReviewFlags(prev => ({ ...prev, [imageId]: currentFlag }))
      alert('Failed to update review flag. Please try again.')
    } finally {
      setLoading(prev => ({ ...prev, [imageId]: false }))
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {images.map((image) => {
        const cacheBust = image.processed_at ? `?t=${new Date(image.processed_at).getTime()}` : ''
        const croppedUrl = image.processed_image_url 
          ? `${image.processed_image_url}${cacheBust}`
          : `/api/crop-image?id=${image.id}`
        const confidence = Math.round((image.crop_confidence || 0) * 100)
        const needsReview = reviewFlags[image.id]
        const isLoading = loading[image.id]
        
        return (
          <div 
            key={image.id} 
            className={`bg-white rounded-lg shadow overflow-hidden ${needsReview ? 'ring-2 ring-orange-500' : ''}`}
          >
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
              {needsReview && (
                <div className="absolute top-2 right-2 bg-orange-500/90 text-white text-xs px-2 py-1 rounded font-semibold">
                  REVIEW
                </div>
              )}
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

              {/* Review button */}
              <button
                onClick={() => toggleReview(image.id)}
                disabled={isLoading}
                className={`mt-3 w-full py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  needsReview
                    ? 'bg-orange-500 text-white hover:bg-orange-600'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isLoading ? 'Updating...' : needsReview ? '✓ Flagged for Review' : 'Flag for Review'}
              </button>

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
  )
}
