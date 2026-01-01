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
      <div className="h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading preview...</div>
      </div>
    )
  }

  if (!experiment || samples.length === 0) {
    return (
      <div className="h-screen bg-gray-50 flex items-center justify-center">
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
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Compact Fixed Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <span className="text-xs text-blue-600 font-semibold">PREVIEW</span>
            <h1 className="text-lg font-bold text-gray-900">{experiment.name}</h1>
          </div>
          <Link
            href={`/admin/experiments/${experimentId}`}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
          >
            Exit
          </Link>
        </div>
      </header>

      {/* Progress Bar - Static */}
      <div className="bg-white border-b border-gray-200 flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 py-2">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-medium text-gray-700">Set {currentSetIndex + 1} of {totalSets}</span>
            <span className="text-xs text-gray-500">{Math.round(((currentSetIndex + 1) / totalSets) * 100)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div 
              className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${((currentSetIndex + 1) / totalSets) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border-b border-blue-200 flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 py-2">
          <p className="text-xs text-blue-900">
            {experiment.instructions || 'Select the image that best represents what you are evaluating.'}
          </p>
        </div>
      </div>

      {/* Main Content - Scrollable */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-4 py-4">
          {/* Image Grid - 2x2 with cropped display */}
          <div className="grid grid-cols-2 gap-3">
            {currentSet.map((sample) => {
              const isSelected = selections[currentSetIndex] === sample.sample_id
              return (
                <button
                  key={sample.id}
                  onClick={() => handleSelection(sample.sample_id)}
                  className={`relative rounded-lg overflow-hidden border-4 transition-all ${
                    isSelected 
                      ? 'border-blue-500 ring-4 ring-blue-200' 
                      : 'border-gray-300 hover:border-blue-300'
                  }`}
                  style={{ height: '280px' }}
                >
                  {sample.image_url ? (
                    <div className="relative w-full h-full bg-gray-100">
                      <Image
                        src={sample.image_url}
                        alt={sample.standardized_chop_id}
                        fill
                        className="object-cover"
                        style={{
                          objectPosition: 'center 40%',
                          transform: 'scale(1.5)'
                        }}
                        sizes="(max-width: 768px) 50vw, 33vw"
                      />
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-100">
                      <span className="text-gray-400 text-sm">No image</span>
                    </div>
                  )}
                  {isSelected && (
                    <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full p-1.5">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Navigation */}
          <div className="flex justify-between items-center mt-4">
            <button
              onClick={handlePrevious}
              disabled={currentSetIndex === 0}
              className="px-5 py-2 bg-gray-300 text-gray-700 text-sm font-medium rounded hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ← Previous
            </button>
            
            {currentSetIndex < totalSets - 1 ? (
              <button
                onClick={handleNext}
                disabled={!selections[currentSetIndex]}
                className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            ) : (
              <button
                disabled={!selections[currentSetIndex]}
                className="px-5 py-2 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Submit (Preview)
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
