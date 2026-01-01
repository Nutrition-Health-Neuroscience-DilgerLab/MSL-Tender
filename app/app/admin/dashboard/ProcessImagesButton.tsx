'use client'

import { useState } from 'react'

export default function ProcessImagesButton() {
  const [processing, setProcessing] = useState(false)
  const [status, setStatus] = useState<{ total: number; processed: number; remaining: number } | null>(null)
  const [message, setMessage] = useState<string>('')

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/process-images')
      const data = await response.json()
      setStatus(data)
    } catch (error) {
      console.error('Error fetching status:', error)
    }
  }

  const processImages = async () => {
    if (processing) return
    
    setProcessing(true)
    setMessage('Cropping images...')
    
    try {
      const response = await fetch('/api/process-images', { method: 'POST' })
      const result = await response.json()
      
      if (response.ok) {
        setMessage(`Success! Cropped ${result.processed} images. Failed: ${result.failed}`)
        await fetchStatus()
      } else {
        setMessage(`Error: ${result.error}`)
      }
    } catch (error) {
      console.error('Error cropping images:', error)
      setMessage('Failed to crop images. Check console for details.')
    } finally {
      setProcessing(false)
    }
  }

  // Load status on mount
  useState(() => {
    fetchStatus()
  })

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Crop Images</h3>
      
      {status && (
        <div className="mb-4 text-sm text-gray-600">
          <p><strong>Total Images:</strong> {status.total}</p>
          <p><strong>Cropped:</strong> {status.processed}</p>
          <p><strong>Remaining:</strong> {status.remaining}</p>
        </div>
      )}

      <button
        onClick={processImages}
        disabled={processing || (status?.remaining === 0)}
        className="w-full px-4 py-2 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {processing ? 'Cropping...' : 'Crop Images'}
      </button>

      {message && (
        <p className={`mt-3 text-sm ${message.startsWith('Success') ? 'text-green-600' : message.startsWith('Error') ? 'text-red-600' : 'text-gray-600'}`}>
          {message}
        </p>
      )}

      <p className="mt-3 text-xs text-gray-500">
        Automatically detects and crops pork chop images for better display.
        Processes in batches of 100.
      </p>
    </div>
  )
}
