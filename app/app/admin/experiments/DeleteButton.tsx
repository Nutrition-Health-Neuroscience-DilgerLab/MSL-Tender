'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function DeleteButton({ experimentId, experimentName }: { experimentId: string; experimentName: string }) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleDelete = async () => {
    setDeleting(true)
    
    try {
      const { error } = await supabase
        .from('experiments')
        .delete()
        .eq('id', experimentId)

      if (error) throw error

      router.push('/admin/experiments')
      router.refresh()
    } catch (error) {
      console.error('Error deleting experiment:', error)
      alert('Failed to delete experiment')
      setDeleting(false)
      setShowConfirm(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className="text-red-600 hover:text-red-900"
      >
        Delete
      </button>

      {showConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Delete Experiment</h3>
            <p className="text-gray-900 mb-6">
              Are you sure you want to delete <strong>&quot;{experimentName}&quot;</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
