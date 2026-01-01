'use client'

import { useState } from 'react'
import Image from 'next/image'

interface CroppedImageProps {
  imageUrl: string
  imageId: number
  alt: string
  cropCoords?: {
    x1: number
    y1: number
    x2: number
    y2: number
    confidence: number
  } | null
  sizes?: string
}

export default function CroppedImage({ imageUrl, imageId, alt, cropCoords, sizes }: CroppedImageProps) {
  const [showFull, setShowFull] = useState(false)
  const [imageError, setImageError] = useState(false)

  if (imageError) {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
        Image failed to load
      </div>
    )
  }

  // If we have crop coordinates and we're not in "show full" mode, use our crop API
  const hasCropCoords = cropCoords && cropCoords.x1 !== 0 && cropCoords.x2 !== 0
  
  if (hasCropCoords && !showFull) {
    // Use the crop API endpoint
    const croppedUrl = `/api/crop-image?id=${imageId}&x1=${cropCoords.x1}&y1=${cropCoords.y1}&x2=${cropCoords.x2}&y2=${cropCoords.y2}`
    
    return (
      <div className="relative h-full w-full">
        <Image
          src={croppedUrl}
          alt={alt}
          fill
          className="object-contain bg-white"
          sizes={sizes}
          onError={() => setImageError(true)}
          unoptimized
        />
        
        {/* Toggle button */}
        <button
          onClick={() => setShowFull(true)}
          className="absolute bottom-2 right-2 bg-black/50 hover:bg-black/70 text-white text-xs px-2 py-1 rounded z-10"
          title={`Confidence: ${(cropCoords.confidence * 100).toFixed(0)}%`}
        >
          Show Full
        </button>
        
        {/* Confidence indicator */}
        <div className="absolute top-2 left-2 bg-green-500/80 text-white text-xs px-2 py-1 rounded z-10">
          {(cropCoords.confidence * 100).toFixed(0)}%
        </div>
      </div>
    )
  }

  // Show full image (either no crop coords or user clicked "show full")
  return (
    <div className="relative h-full w-full">
      <Image
        src={imageUrl}
        alt={alt}
        fill
        className="object-cover"
        sizes={sizes}
        onError={() => setImageError(true)}
      />
      {hasCropCoords && showFull && (
        <button
          onClick={() => setShowFull(false)}
          className="absolute bottom-2 right-2 bg-black/50 hover:bg-black/70 text-white text-xs px-2 py-1 rounded z-10"
        >
          Show Cropped
        </button>
      )}
    </div>
  )
}
