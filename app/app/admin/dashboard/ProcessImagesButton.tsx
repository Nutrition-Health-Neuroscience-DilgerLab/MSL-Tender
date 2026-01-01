'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ProcessImagesButton() {
  const router = useRouter()
  const [processing, setProcessing] = useState(false)
  const [status, setStatus] = useState<{ total: number; processed: number; remaining: number } | null>(null)
  const [message, setMessage] = useState<string>('')
  const [testMode, setTestMode] = useState(true)
  const [cleaning, setCleaning] = useState(false)
  const [cleanupMessage, setCleanupMessage] = useState<string>('')

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/process-images')
      const data = await response.json()
      setStatus(data)
    } catch (error) {
      console.error('Error fetching status:', error)
    }
  }

  const processImages = async (reprocess = false) => {
    if (processing) return
    
    setProcessing(true)
    setMessage(reprocess ? 'Reprocessing images...' : 'Cropping images...')
    
    try {
      let url = testMode ? '/api/process-images?test=true' : '/api/process-images'
      if (reprocess) url += testMode ? '&reprocess=true' : '?reprocess=true'
      
      const response = await fetch(url, { method: 'POST' })
      const result = await response.json()
      
      console.log('API Response:', { status: response.status, result })
      
      if (response.ok) {
        setMessage(`Success! ${reprocess ? 'Reprocessed' : 'Cropped'} ${result.processed} images. Failed: ${result.failed}`)
        await fetchStatus()
        
        // Redirect to the cropped images page to see results
        setTimeout(() => {
          router.push('/admin/crop-test')
        }, 1000)
      } else {
        const errorDetails = result.details || result.error || 'Unknown error'
        const exitCode = result.exitCode ? ` (exit code: ${result.exitCode})` : ''
        setMessage(`Error: ${errorDetails}${exitCode}`)
        console.error('Full error response:', JSON.stringify(result, null, 2))
        
        // Show additional debug info if available
        if (result.output) {
          console.error('Python output:', result.output)
        }
        if (result.stack) {
          console.error('Stack trace:', result.stack)
        }
      }
    } catch (error) {
      console.error('Exception during image cropping:', error)
      console.error('Error type:', error?.constructor?.name)
      console.error('Error message:', error instanceof Error ? error.message : String(error))
      setMessage(`Failed to crop images: ${error instanceof Error ? error.message : 'Unknown error'}. Check console for details.`)
    } finally {
      setProcessing(false)
    }
  }

  const cleanupR2 = async () => {
    if (cleaning) return
    
    setCleaning(true)
    setCleanupMessage('Cleaning up old R2 folders...')
    
    try {
      const response = await fetch('/api/cleanup-r2', { method: 'POST' })
      const result = await response.json()
      
      if (response.ok) {
        const total = Object.values(result.results).reduce((sum: number, count) => sum + (count as number), 0)
        setCleanupMessage(`Success! Deleted ${total} objects from old folders.`)
      } else {
        setCleanupMessage(`Error: ${result.error || result.details || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error cleaning up R2:', error)
      setCleanupMessage(`Failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setCleaning(false)
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

      <label className="flex items-center mb-3 text-sm text-gray-700 cursor-pointer">
        <input
          type="checkbox"
          checked={testMode}
          onChange={(e) => setTestMode(e.target.checked)}
          className="mr-2 rounded border-gray-300 text-green-600 focus:ring-green-500"
        />
        <span>Test Mode (process only 5 random images)</span>
      </label>

      <button
        onClick={() => processImages(false)}
        disabled={processing || (status?.remaining === 0)}
        className="w-full px-4 py-2 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {processing ? 'Cropping...' : testMode ? 'Test Crop (5 Images)' : 'Crop Images'}
      </button>

      <button
        onClick={() => processImages(true)}
        disabled={processing || (status?.processed === 0)}
        className="w-full mt-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {processing ? 'Reprocessing...' : testMode ? 'Reprocess Test Images (10)' : 'Reprocess All'}
      </button>

      <button
        onClick={cleanupR2}
        disabled={cleaning}
        className="w-full mt-2 px-4 py-2 bg-red-600 text-white font-medium rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {cleaning ? 'Cleaning...' : 'Clean Up Old R2 Folders'}
      </button>

      {cleanupMessage && (
        <p className={`mt-2 text-sm ${cleanupMessage.startsWith('Success') ? 'text-green-600' : 'text-red-600'}`}>
          {cleanupMessage}
        </p>
      )}

      {message && (
        <p className={`mt-3 text-sm ${message.startsWith('Success') ? 'text-green-600' : message.startsWith('Error') ? 'text-red-600' : 'text-gray-600'}`}>
          {message}
        </p>
      )}

      <p className="mt-3 text-xs text-gray-500">
        {testMode 
          ? 'Test mode will process 5 random unprocessed images. View results after processing completes.' 
          : 'Automatically detects and crops pork chop images for better display. Processes in batches of 100. View results after processing completes.'}
      </p>
    </div>
  )
}
