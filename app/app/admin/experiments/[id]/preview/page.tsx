/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'

type Sample = {
  id: string
  sample_id: string
  sample_order: number
  standardized_chop_id: string
  image_url?: string
}

export default function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [experiment, setExperiment] = useState<any>(null)
  const [samples, setSamples] = useState<Sample[]>([])
  const [currentSetIndex, setCurrentSetIndex] = useState(0)
  const [selections, setSelections] = useState<Record<number, string>>({})
  const [experimentId, setExperimentId] = useState<string>('')

  useEffect(() => {
    params.then(p => {
      setExperimentId(p.id)
      loadExperiment(p.id)
    })
  }, [])

  const loadExperiment = async (id: string) => {
    setLoading(true)

    // Get experiment
    const { data: exp, error: expError } = await supabase
      .from('experiments')
      .select('*')
      .eq('id', id)
      .single()

    if (expError || !exp) {
      alert('Experiment not found')
      router.push('/admin/experiments')
      return
    }

    // Get samples with images
    const { data: experimentSamples } = await supabase
      .from('experiment_samples')
      .select(`
        id,
        sample_id,
        sample_order,
        pork_samples!inner (
          standardized_chop_id
        )
      `)
      .eq('experiment_id', id)
      .order('sample_order', { ascending: true })

    if (!experimentSamples || experimentSamples.length === 0) {
      alert('No samples in this experiment')
      router.push(`/admin/experiments/${id}`)
      return
    }

    // Get images
    const sampleIds = experimentSamples.map((es: any) => es.sample_id)
    const { data: images } = await supabase
      .from('sample_images')
      .select('sample_id, image_url')
      .in('sample_id', sampleIds)

    const imageMap = new Map(images?.map((img: any) => [img.sample_id, img.image_url]) || [])

    const samplesData: Sample[] = experimentSamples.map((es: any) => ({
      id: es.id,
      sample_id: es.sample_id,
      sample_order: es.sample_order,
      standardized_chop_id: es.pork_samples.standardized_chop_id,
      image_url: imageMap.get(es.sample_id)
    }))

    setExperiment(exp)
    setSamples(samplesData)
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading preview...</div>
      </div>
    )
  }

  if (!experiment || samples.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg text-gray-600">No data available</div>
      </div>
    )
  }

  // Group samples into sets of 4
  const sets: Sample[][] = []
  for (let i = 0; i < samples.length; i += 4) {
    sets.push(samples.slice(i, i + 4))
  }

  const currentSet = sets[currentSetIndex] || []
  const totalSets = sets.length

  const handleSelection = (sampleId: string) => {
    setSelections({ ...selections, [currentSetIndex]: sampleId })
  }

  const handleNext = () => {
    if (currentSetIndex < totalSets - 1) {
      setCurrentSetIndex(currentSetIndex + 1)
    }
  }

  const handlePrevious = () => {
    if (currentSetIndex > 0) {
      setCurrentSetIndex(currentSetIndex - 1)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-xs text-blue-600 font-medium mb-1">PREVIEW MODE</div>
              <h1 className="text-2xl font-bold text-gray-900">{experiment.name}</h1>
              {experiment.description && (
                <p className="text-sm text-gray-600 mt-1">{experiment.description}</p>
              )}
            </div>
            <Link
              href={`/admin/experiments/${experimentId}`}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Exit Preview
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">Set {currentSetIndex + 1} of {totalSets}</span>
            <span className="text-sm text-gray-500">{Math.round(((currentSetIndex + 1) / totalSets) * 100)}% Complete</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentSetIndex + 1) / totalSets) * 100}%` }}
            />
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
          <p className="text-sm text-blue-900">
            {experiment.instructions || 'Please select the image that best represents what you are evaluating.'}
          </p>
        </div>

        {/* Image Grid */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Select One Image</h2>
          <div className="grid grid-cols-2 gap-6">
            {currentSet.map((sample) => {
              const isSelected = selections[currentSetIndex] === sample.sample_id
              return (
                <button
                  key={sample.id}
                  onClick={() => handleSelection(sample.sample_id)}
                  className={`relative aspect-square rounded-lg overflow-hidden border-4 transition-all ${
                    isSelected 
                      ? 'border-blue-500 ring-4 ring-blue-200' 
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  {sample.image_url ? (
                    <Image
                      src={sample.image_url}
                      alt={sample.standardized_chop_id}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 50vw"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                      <span className="text-gray-400">No image</span>
                    </div>
                  )}
                  {isSelected && (
                    <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full p-2">
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 text-white text-xs p-2">
                    {sample.standardized_chop_id}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <button
            onClick={handlePrevious}
            disabled={currentSetIndex === 0}
            className="px-6 py-3 bg-gray-300 text-gray-700 font-medium rounded-md hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ← Previous
          </button>
          
          {currentSetIndex < totalSets - 1 ? (
            <button
              onClick={handleNext}
              disabled={!selections[currentSetIndex]}
              className="px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          ) : (
            <button
              disabled={!selections[currentSetIndex]}
              className="px-6 py-3 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Submit (Preview)
            </button>
          )}
        </div>

        {/* Selection Summary */}
        {Object.keys(selections).length > 0 && (
          <div className="mt-8 bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Your Selections</h3>
            <div className="text-xs text-gray-600">
              {Object.entries(selections).map(([setIdx, sampleId]) => {
                const sample = samples.find(s => s.sample_id === sampleId)
                return (
                  <div key={setIdx}>
                    Set {parseInt(setIdx) + 1}: {sample?.standardized_chop_id || 'Unknown'}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
