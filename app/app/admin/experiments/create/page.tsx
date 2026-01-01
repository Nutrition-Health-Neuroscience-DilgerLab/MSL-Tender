/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
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
  image_url?: string
}

export default function CreateExperimentPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [samples, setSamples] = useState<Sample[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSamples, setSelectedSamples] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [studyFilter, setStudyFilter] = useState<number | null>(null)
  const [availableStudies, setAvailableStudies] = useState<number[]>([])
  
  // Form state
  const [experimentName, setExperimentName] = useState('')
  const [description, setDescription] = useState('')
  const [experimentType, setExperimentType] = useState('paired_comparison')
  const [randomizeOrder, setRandomizeOrder] = useState(true)
  const [creating, setCreating] = useState(false)

  const loadSamples = async () => {
    setLoading(true)
    
    // Get all samples
    const { data: samplesData, error: samplesError } = await supabase
      .from('pork_samples')
      .select('id, study_number, standardized_chop_id, chop_color, chop_marbling, chop_firmness, ph')
      .order('study_number', { ascending: true })
      .order('standardized_chop_id', { ascending: true })

    if (samplesError) {
      console.error('Error fetching samples:', samplesError)
      setLoading(false)
      return
    }

    // Get images for samples
    const sampleIds = samplesData?.map((s: any) => s.id) || []
    const { data: images } = await supabase
      .from('sample_images')
      .select('sample_id, image_url')
      .in('sample_id', sampleIds)

    // Create image map
    const imageMap = new Map(
      images?.map((img: any) => [img.sample_id, img.image_url]) || []
    )

    // Combine samples with images
    const samplesWithImages = samplesData?.map((sample: any) => ({
      ...sample,
      image_url: imageMap.get(sample.id)
    })) || []

    setSamples(samplesWithImages)

    // Get unique study numbers for filter
    const studies = Array.from(new Set(samplesData?.map((s: any) => s.study_number) || []))
      .sort((a, b) => a - b)
    setAvailableStudies(studies)

    setLoading(false)
  }

  useEffect(() => {
    loadSamples()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleSample = (sampleId: string) => {
    const newSelected = new Set(selectedSamples)
    if (newSelected.has(sampleId)) {
      newSelected.delete(sampleId)
    } else {
      newSelected.add(sampleId)
    }
    setSelectedSamples(newSelected)
  }

  const filteredSamples = samples.filter(sample => {
    const matchesSearch = sample.standardized_chop_id.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStudy = studyFilter === null || sample.study_number === studyFilter
    return matchesSearch && matchesStudy
  })

  const isValidSelection = () => {
    return selectedSamples.size > 0 && selectedSamples.size % 4 === 0
  }

  const createExperiment = async () => {
    if (!experimentName.trim()) {
      alert('Please enter an experiment name')
      return
    }

    if (!isValidSelection()) {
      alert('Please select a multiple of 4 samples')
      return
    }

    setCreating(true)

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        alert('You must be logged in to create an experiment')
        router.push('/admin/login')
        return
      }

      // Create experiment
      const { data: experiment, error: expError } = await supabase
        .from('experiments')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .insert({
          name: experimentName,
          description: description || null,
          experiment_type: experimentType,
          num_images: 4, // Default to sets of 4
          status: 'draft',
          randomize_order: randomizeOrder,
          collect_timing: true,
          collect_click_data: true,
          created_by: user.id
        } as any)
        .select()
        .single()

      if (expError) {
        console.error('Error creating experiment:', expError)
        alert('Failed to create experiment: ' + expError.message)
        setCreating(false)
        return
      }

      // Add samples to experiment
      const experimentSamples = Array.from(selectedSamples).map((sampleId, index) => ({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        experiment_id: (experiment as any).id,
        sample_id: sampleId,
        display_order: index,
        set_number: Math.floor(index / 4) // Group into sets of 4
      }))

      const { error: samplesError } = await supabase
        .from('experiment_samples')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .insert(experimentSamples as any)

      if (samplesError) {
        console.error('Error adding samples:', samplesError)
        alert('Failed to add samples to experiment: ' + samplesError.message)
        setCreating(false)
        return
      }

      // Success! Redirect to experiment details
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      router.push(`/admin/experiments/${(experiment as any).id}`)
    } catch (error) {
      console.error('Error:', error)
      alert('An unexpected error occurred')
      setCreating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <Link 
                href="/admin/experiments"
                className="text-sm text-gray-600 hover:text-gray-900 mb-2 inline-block"
              >
                ← Back to Experiments
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">Create New Experiment</h1>
            </div>
            <div className="text-sm">
              <span className={`font-medium ${isValidSelection() ? 'text-green-600' : 'text-red-600'}`}>
                {selectedSamples.size} samples selected
              </span>
              <span className="text-gray-500 ml-2">
                ({selectedSamples.size % 4 === 0 ? '✓' : '✗'} must be multiple of 4)
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Experiment Configuration */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6 sticky top-24">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Experiment Details</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Experiment Name *
                  </label>
                  <input
                    type="text"
                    value={experimentName}
                    onChange={(e) => setExperimentName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="e.g., Spring 2025 Tenderness Study"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Optional description..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Experiment Type
                  </label>
                  <select
                    value={experimentType}
                    onChange={(e) => setExperimentType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="paired_comparison">Paired Comparison</option>
                    <option value="ranking">Ranking</option>
                    <option value="preference">Preference</option>
                  </select>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="randomize"
                    checked={randomizeOrder}
                    onChange={(e) => setRandomizeOrder(e.target.checked)}
                    className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                  />
                  <label htmlFor="randomize" className="ml-2 text-sm text-gray-700">
                    Randomize sample order for participants
                  </label>
                </div>

                <div className="pt-4 border-t">
                  <div className="text-sm text-gray-600 space-y-2">
                    <p><strong>Selected:</strong> {selectedSamples.size} samples</p>
                    <p><strong>Sets of 4:</strong> {Math.floor(selectedSamples.size / 4)}</p>
                  </div>
                </div>

                <button
                  onClick={createExperiment}
                  disabled={!isValidSelection() || !experimentName.trim() || creating}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {creating ? 'Creating...' : 'Create Experiment'}
                </button>
              </div>
            </div>
          </div>

          {/* Right: Sample Selection */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow">
              {/* Filters */}
              <div className="p-4 border-b border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Search
                    </label>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search by Chop ID..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Filter by Study
                    </label>
                    <select
                      value={studyFilter || ''}
                      onChange={(e) => setStudyFilter(e.target.value ? Number(e.target.value) : null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="">All Studies</option>
                      {availableStudies.map(study => (
                        <option key={study} value={study}>Study {study}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Sample Grid */}
              <div className="p-4">
                {loading ? (
                  <div className="text-center py-12 text-gray-500">Loading samples...</div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {filteredSamples.map(sample => {
                      const isSelected = selectedSamples.has(sample.id)
                      return (
                        <div
                          key={sample.id}
                          onClick={() => toggleSample(sample.id)}
                          className={`relative border-2 rounded-lg overflow-hidden cursor-pointer transition-all ${
                            isSelected 
                              ? 'border-green-500 ring-2 ring-green-500 ring-offset-2' 
                              : 'border-gray-200 hover:border-green-300'
                          }`}
                        >
                          {/* Selection Checkbox */}
                          <div className="absolute top-2 left-2 z-10">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                              isSelected ? 'bg-green-500' : 'bg-white border-2 border-gray-300'
                            }`}>
                              {isSelected && (
                                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                          </div>

                          {/* Image */}
                          <div className="aspect-square bg-gray-100 relative">
                            {sample.image_url ? (
                              <Image
                                src={sample.image_url}
                                alt={sample.standardized_chop_id}
                                fill
                                className="object-cover"
                                sizes="(max-width: 768px) 50vw, 33vw"
                              />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                                No image
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="p-2 bg-white">
                            <div className="text-xs font-semibold text-gray-900 truncate">
                              {sample.standardized_chop_id}
                            </div>
                            <div className="text-xs text-gray-500">
                              Study {sample.study_number}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {!loading && filteredSamples.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    No samples found matching your filters
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
