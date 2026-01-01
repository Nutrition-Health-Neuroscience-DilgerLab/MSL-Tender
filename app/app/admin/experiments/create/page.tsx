/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ThemeToggle from '@/app/components/ThemeToggle'

type FilterCriteria = {
  studyNumbers: number[]
  minoLRange: { min: number; max: number } | null
  minoARange: { min: number; max: number } | null
  minoBRange: { min: number; max: number } | null
  colorRange: { min: number; max: number } | null
  marblingRange: { min: number; max: number } | null
  firmnessRange: { min: number; max: number } | null
  phRange: { min: number; max: number } | null
}

type FieldBounds = {
  minolta_chop_l: { min: number; max: number }
  minolta_chop_a: { min: number; max: number }
  minolta_chop_b: { min: number; max: number }
  chop_color: { min: number; max: number }
  chop_marbling: { min: number; max: number }
  chop_firmness: { min: number; max: number }
  ph: { min: number; max: number }
}

type ExperimentConfig = {
  name: string
  description: string
  type: string
  numberOfSets: number
  samplingStrategy: 'random' | 'stratified'
}

export default function CreateExperimentPage() {
  const router = useRouter()
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [availableStudies, setAvailableStudies] = useState<number[]>([])
  const [matchingCount, setMatchingCount] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [bounds, setBounds] = useState<FieldBounds | null>(null)
  
  // Step 1: Filter criteria
  const [filters, setFilters] = useState<FilterCriteria>({
    studyNumbers: [],
    minoLRange: null,
    minoARange: null,
    minoBRange: null,
    colorRange: null,
    marblingRange: null,
    firmnessRange: null,
    phRange: null,
  })
  
  // Step 2: Experiment configuration
  const [config, setConfig] = useState<ExperimentConfig>({
    name: '',
    description: '',
    type: 'paired_comparison',
    numberOfSets: 10,
    samplingStrategy: 'random',
  })

  useEffect(() => {
    loadUser()
    loadAvailableStudies()
    loadSampleBounds()
  }, [])

  useEffect(() => {
    if (step === 1) {
      updateMatchingCount()
    }
  }, [filters, step])

  const loadUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
  }

  const loadAvailableStudies = async () => {
    const { data } = await supabase
      .from('pork_samples')
      .select('study_number')
    
    if (data) {
      const studies = Array.from(new Set(data.map((s: any) => s.study_number)))
        .sort((a, b) => a - b)
      setAvailableStudies(studies)
    }
  }

  const loadSampleBounds = async () => {
    try {
      const response = await fetch('/api/sample-bounds')
      const data = await response.json()
      setBounds(data)
    } catch (error) {
      console.error('Error loading sample bounds:', error)
    }
  }


  const updateMatchingCount = async () => {
    setLoading(true)
    
    let query = supabase
      .from('pork_samples')
      .select('id', { count: 'exact', head: true })
    
    // Apply filters
    if (filters.studyNumbers.length > 0) {
      query = query.in('study_number', filters.studyNumbers)
    }
    if (filters.minoLRange) {
      query = query.gte('minolta_chop_l', filters.minoLRange.min).lte('minolta_chop_l', filters.minoLRange.max)
    }
    if (filters.minoARange) {
      query = query.gte('minolta_chop_a', filters.minoARange.min).lte('minolta_chop_a', filters.minoARange.max)
    }
    if (filters.minoBRange) {
      query = query.gte('minolta_chop_b', filters.minoBRange.min).lte('minolta_chop_b', filters.minoBRange.max)
    }
    if (filters.colorRange) {
      query = query.gte('chop_color', filters.colorRange.min).lte('chop_color', filters.colorRange.max)
    }
    if (filters.marblingRange) {
      query = query.gte('chop_marbling', filters.marblingRange.min).lte('chop_marbling', filters.marblingRange.max)
    }
    if (filters.firmnessRange) {
      query = query.gte('chop_firmness', filters.firmnessRange.min).lte('chop_firmness', filters.firmnessRange.max)
    }
    if (filters.phRange) {
      query = query.gte('ph', filters.phRange.min).lte('ph', filters.phRange.max)
    }
    
    const { count } = await query
    setMatchingCount(count || 0)
    setLoading(false)
  }

  const handleCreateExperiment = async () => {
    if (!config.name || config.numberOfSets < 1) return

    setLoading(true)

    try {
      // Query samples matching the filter criteria
      let query = supabase
        .from('pork_samples')
        .select('id')
      
      if (filters.studyNumbers.length > 0) {
        query = query.in('study_number', filters.studyNumbers)
      }
      if (filters.minoLRange) {
        query = query.gte('minolta_chop_l', filters.minoLRange.min).lte('minolta_chop_l', filters.minoLRange.max)
      }
      if (filters.minoARange) {
        query = query.gte('minolta_chop_a', filters.minoARange.min).lte('minolta_chop_a', filters.minoARange.max)
      }
      if (filters.minoBRange) {
        query = query.gte('minolta_chop_b', filters.minoBRange.min).lte('minolta_chop_b', filters.minoBRange.max)
      }
      if (filters.colorRange) {
        query = query.gte('chop_color', filters.colorRange.min).lte('chop_color', filters.colorRange.max)
      }
      if (filters.marblingRange) {
        query = query.gte('chop_marbling', filters.marblingRange.min).lte('chop_marbling', filters.marblingRange.max)
      }
      if (filters.firmnessRange) {
        query = query.gte('chop_firmness', filters.firmnessRange.min).lte('chop_firmness', filters.firmnessRange.max)
      }
      if (filters.phRange) {
        query = query.gte('ph', filters.phRange.min).lte('ph', filters.phRange.max)
      }
      
      const { data: filteredSamples, error: queryError } = await query
      
      if (queryError) throw queryError
      if (!filteredSamples || filteredSamples.length === 0) {
        alert('No samples match the filter criteria')
        setLoading(false)
        return
      }

      const samplesNeeded = config.numberOfSets * 4
      if (filteredSamples.length < samplesNeeded) {
        alert(`Need ${samplesNeeded} samples but only ${filteredSamples.length} match the criteria`)
        setLoading(false)
        return
      }

      // Apply sampling strategy
      let selectedSamples: string[]
      if (config.samplingStrategy === 'random') {
        // Shuffle and take needed samples
        const shuffled = [...filteredSamples].sort(() => Math.random() - 0.5)
        selectedSamples = shuffled.slice(0, samplesNeeded).map((s: any) => s.id)
      } else {
        // Stratified sampling - for now, just random
        // TODO: implement proper stratification based on color/marbling/firmness
        const shuffled = [...filteredSamples].sort(() => Math.random() - 0.5)
        selectedSamples = shuffled.slice(0, samplesNeeded).map((s: any) => s.id)
      }

      // Create experiment
      const { data: experiment, error: expError } = await supabase
        .from('experiments')
        .insert({
          name: config.name,
          description: config.description,
          status: 'draft',
          experiment_type: config.type,
          num_images: 4,
          created_by: user?.id
        } as any)
        .select()
        .single()

      if (expError) throw expError

      // Create comparison sets (groups of 4)
      const experimentSamples = []
      for (let i = 0; i < config.numberOfSets; i++) {
        const setStart = i * 4
        for (let j = 0; j < 4; j++) {
          experimentSamples.push({
            experiment_id: (experiment as any).id,
            sample_id: selectedSamples[setStart + j],
            sample_order: setStart + j
          })
        }
      }

      const { error: samplesError } = await supabase
        .from('experiment_samples')
        .insert(experimentSamples as any)

      if (samplesError) throw samplesError

      // Success!
      router.push('/admin/experiments')
    } catch (error) {
      console.error('Error creating experiment:', error)
      alert('Failed to create experiment')
      setLoading(false)
    }
  }

  const toggleStudy = (studyNumber: number) => {
    setFilters(prev => ({
      ...prev,
      studyNumbers: prev.studyNumbers.includes(studyNumber)
        ? prev.studyNumbers.filter(s => s !== studyNumber)
        : [...prev.studyNumbers, studyNumber]
    }))
  }

  const canProceedToStep2 = matchingCount >= config.numberOfSets * 4
  const canProceedToStep3 = config.name.trim().length > 0 && config.numberOfSets > 0

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-10 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <Link 
                href="/admin/experiments"
                className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white mb-2 inline-block transition-colors"
              >
                ← Back to Experiments
              </Link>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create New Experiment</h1>
            </div>
            <ThemeToggle />
          </div>
          
          {/* Step Indicator */}
          <div className="mt-4 flex items-center justify-center">
            <div className="flex items-center">
              {[1, 2, 3].map((s, idx) => (
                <div key={s} className="flex items-center">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                    step >= s 
                      ? 'bg-green-500 border-green-500 text-white' 
                      : 'bg-gray-100 border-gray-300 text-gray-400'
                  }`}>
                    {s}
                  </div>
                  {idx < 2 && (
                    <div className={`w-16 h-1 ${
                      step > s ? 'bg-green-500' : 'bg-gray-300'
                    }`} />
                  )}
                </div>
              ))}
            </div>
            <div className="ml-6 text-sm text-gray-600 dark:text-gray-400">
              {step === 1 && 'Define Sample Pool'}
              {step === 2 && 'Configure Experiment'}
              {step === 3 && 'Review & Create'}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Step 1: Define Sample Pool */}
        {step === 1 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Step 1: Define Sample Pool
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Select criteria to filter the pool of samples for this experiment.
            </p>

            <div className="space-y-6">
              {/* Study Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Studies to Include
                </label>
                <div className="flex flex-wrap gap-2">
                  {availableStudies.map(study => (
                    <button
                      key={study}
                      onClick={() => toggleStudy(study)}
                      className={`px-3 py-1 rounded-md text-sm transition-colors ${
                        filters.studyNumbers.includes(study)
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      Study {study}
                    </button>
                  ))}
                </div>
                {filters.studyNumbers.length === 0 && (
                  <p className="text-xs text-gray-500 mt-1">All studies selected (no filter)</p>
                )}
              </div>

              {/* Minolta Color Ranges */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Minolta Color Values
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      L* (Lightness{bounds ? `: ${bounds.minolta_chop_l.min}-${bounds.minolta_chop_l.max}` : ''})
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder={bounds ? String(bounds.minolta_chop_l.min) : 'Min'}
                        value={filters.minoLRange?.min ?? ''}
                        min={bounds?.minolta_chop_l.min}
                        max={bounds?.minolta_chop_l.max}
                        onChange={(e) => setFilters(prev => ({
                          ...prev,
                          minoLRange: e.target.value ? { 
                            min: Number(e.target.value), 
                            max: prev.minoLRange?.max ?? bounds?.minolta_chop_l.max ?? 100 
                          } : null
                        }))}
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                      <input
                        type="number"
                        placeholder={bounds ? String(bounds.minolta_chop_l.max) : 'Max'}
                        value={filters.minoLRange?.max ?? ''}
                        min={bounds?.minolta_chop_l.min}
                        max={bounds?.minolta_chop_l.max}
                        onChange={(e) => setFilters(prev => ({
                          ...prev,
                          minoLRange: e.target.value ? { 
                            min: prev.minoLRange?.min ?? bounds?.minolta_chop_l.min ?? 0, 
                            max: Number(e.target.value) 
                          } : null
                        }))}
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      a* (Red/Green{bounds ? `: ${bounds.minolta_chop_a.min}-${bounds.minolta_chop_a.max}` : ''})
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder={bounds ? String(bounds.minolta_chop_a.min) : 'Min'}
                        value={filters.minoARange?.min ?? ''}
                        min={bounds?.minolta_chop_a.min}
                        max={bounds?.minolta_chop_a.max}
                        onChange={(e) => setFilters(prev => ({
                          ...prev,
                          minoARange: e.target.value ? { 
                            min: Number(e.target.value), 
                            max: prev.minoARange?.max ?? bounds?.minolta_chop_a.max ?? 60 
                          } : null
                        }))}
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                      <input
                        type="number"
                        placeholder={bounds ? String(bounds.minolta_chop_a.max) : 'Max'}
                        value={filters.minoARange?.max ?? ''}
                        min={bounds?.minolta_chop_a.min}
                        max={bounds?.minolta_chop_a.max}
                        onChange={(e) => setFilters(prev => ({
                          ...prev,
                          minoARange: e.target.value ? { 
                            min: prev.minoARange?.min ?? bounds?.minolta_chop_a.min ?? -60, 
                            max: Number(e.target.value) 
                          } : null
                        }))}
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      b* (Yellow/Blue{bounds ? `: ${bounds.minolta_chop_b.min}-${bounds.minolta_chop_b.max}` : ''})
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder={bounds ? String(bounds.minolta_chop_b.min) : 'Min'}
                        value={filters.minoBRange?.min ?? ''}
                        min={bounds?.minolta_chop_b.min}
                        max={bounds?.minolta_chop_b.max}
                        onChange={(e) => setFilters(prev => ({
                          ...prev,
                          minoBRange: e.target.value ? { 
                            min: Number(e.target.value), 
                            max: prev.minoBRange?.max ?? bounds?.minolta_chop_b.max ?? 60 
                          } : null
                        }))}
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                      <input
                        type="number"
                        placeholder={bounds ? String(bounds.minolta_chop_b.max) : 'Max'}
                        value={filters.minoBRange?.max ?? ''}
                        min={bounds?.minolta_chop_b.min}
                        max={bounds?.minolta_chop_b.max}
                        onChange={(e) => setFilters(prev => ({
                          ...prev,
                          minoBRange: e.target.value ? { 
                            min: prev.minoBRange?.min ?? bounds?.minolta_chop_b.min ?? -60, 
                            max: Number(e.target.value) 
                          } : null
                        }))}
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Sensory Score Ranges */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Sensory Scores{bounds ? ` (${bounds.chop_color.min}-${bounds.chop_color.max})` : ''}
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Color Score</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder={bounds ? String(bounds.chop_color.min) : 'Min'}
                        value={filters.colorRange?.min ?? ''}
                        min={bounds?.chop_color.min}
                        max={bounds?.chop_color.max}
                        onChange={(e) => setFilters(prev => ({
                          ...prev,
                          colorRange: e.target.value ? { 
                            min: Number(e.target.value), 
                            max: prev.colorRange?.max ?? bounds?.chop_color.max ?? 6 
                          } : null
                        }))}
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                      <input
                        type="number"
                        placeholder={bounds ? String(bounds.chop_color.max) : 'Max'}
                        value={filters.colorRange?.max ?? ''}
                        min={bounds?.chop_color.min}
                        max={bounds?.chop_color.max}
                        onChange={(e) => setFilters(prev => ({
                          ...prev,
                          colorRange: e.target.value ? { 
                            min: prev.colorRange?.min ?? bounds?.chop_color.min ?? 1, 
                            max: Number(e.target.value) 
                          } : null
                        }))}
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Marbling Score</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder={bounds ? String(bounds.chop_marbling.min) : 'Min'}
                        value={filters.marblingRange?.min ?? ''}
                        min={bounds?.chop_marbling.min}
                        max={bounds?.chop_marbling.max}
                        onChange={(e) => setFilters(prev => ({
                          ...prev,
                          marblingRange: e.target.value ? { 
                            min: Number(e.target.value), 
                            max: prev.marblingRange?.max ?? bounds?.chop_marbling.max ?? 6 
                          } : null
                        }))}
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                      <input
                        type="number"
                        placeholder={bounds ? String(bounds.chop_marbling.max) : 'Max'}
                        value={filters.marblingRange?.max ?? ''}
                        min={bounds?.chop_marbling.min}
                        max={bounds?.chop_marbling.max}
                        onChange={(e) => setFilters(prev => ({
                          ...prev,
                          marblingRange: e.target.value ? { 
                            min: prev.marblingRange?.min ?? bounds?.chop_marbling.min ?? 1, 
                            max: Number(e.target.value) 
                          } : null
                        }))}
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Firmness Score</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder={bounds ? String(bounds.chop_firmness.min) : 'Min'}
                        value={filters.firmnessRange?.min ?? ''}
                        min={bounds?.chop_firmness.min}
                        max={bounds?.chop_firmness.max}
                        onChange={(e) => setFilters(prev => ({
                          ...prev,
                          firmnessRange: e.target.value ? { 
                            min: Number(e.target.value), 
                            max: prev.firmnessRange?.max ?? bounds?.chop_firmness.max ?? 6 
                          } : null
                        }))}
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                      <input
                        type="number"
                        placeholder={bounds ? String(bounds.chop_firmness.max) : 'Max'}
                        value={filters.firmnessRange?.max ?? ''}
                        min={bounds?.chop_firmness.min}
                        max={bounds?.chop_firmness.max}
                        onChange={(e) => setFilters(prev => ({
                          ...prev,
                          firmnessRange: e.target.value ? { 
                            min: prev.firmnessRange?.min ?? bounds?.chop_firmness.min ?? 1, 
                            max: Number(e.target.value) 
                          } : null
                        }))}
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* pH Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  pH Range{bounds ? ` (${bounds.ph.min}-${bounds.ph.max})` : ''}
                </label>
                <div className="flex gap-2 max-w-xs">
                  <input
                    type="number"
                    step="0.01"
                    placeholder={bounds ? String(bounds.ph.min) : 'Min'}
                    value={filters.phRange?.min ?? ''}
                    min={bounds?.ph.min}
                    max={bounds?.ph.max}
                    onChange={(e) => setFilters(prev => ({
                      ...prev,
                      phRange: e.target.value ? { 
                        min: Number(e.target.value), 
                        max: prev.phRange?.max ?? bounds?.ph.max ?? 7 
                      } : null
                    }))}
                    className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder={bounds ? String(bounds.ph.max) : 'Max'}
                    value={filters.phRange?.max ?? ''}
                    min={bounds?.ph.min}
                    max={bounds?.ph.max}
                    onChange={(e) => setFilters(prev => ({
                      ...prev,
                      phRange: e.target.value ? { 
                        min: prev.phRange?.min ?? bounds?.ph.min ?? 5, 
                        max: Number(e.target.value) 
                      } : null
                    }))}
                    className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Matching Count */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {loading ? (
                    'Counting matching samples...'
                  ) : (
                    <>
                      <span className="text-2xl font-bold text-gray-900 dark:text-white">{matchingCount}</span> samples match your criteria
                      <div className="mt-1 text-xs">
                        {matchingCount >= config.numberOfSets * 4 ? (
                          <span className="text-green-600 dark:text-green-400">✓ Enough samples for {config.numberOfSets} sets of 4</span>
                        ) : (
                          <span className="text-orange-600 dark:text-orange-400">Need {config.numberOfSets * 4} samples for {config.numberOfSets} sets</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Navigation */}
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setStep(2)}
                disabled={!canProceedToStep2}
                className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                Next: Configure Experiment →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Configure Experiment */}
        {step === 2 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Step 2: Configure Experiment
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Specify experiment details and how to generate comparison sets.
            </p>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Experiment Name *
                </label>
                <input
                  type="text"
                  value={config.name}
                  onChange={(e) => setConfig(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Spring 2025 Tenderness Study"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description (optional)
                </label>
                <textarea
                  value={config.description}
                  onChange={(e) => setConfig(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  placeholder="Optional description..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Experiment Type
                </label>
                <select
                  value={config.type}
                  onChange={(e) => setConfig(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="paired_comparison">Paired Comparison</option>
                  <option value="ranking">Ranking</option>
                  <option value="preference">Preference Test</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Number of Comparison Sets
                </label>
                <input
                  type="number"
                  min="1"
                  max={Math.floor(matchingCount / 4)}
                  value={config.numberOfSets}
                  onChange={(e) => setConfig(prev => ({ ...prev, numberOfSets: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Each set contains 4 images. Total samples needed: {config.numberOfSets * 4}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Sampling Strategy
                </label>
                <div className="space-y-2">
                  <label className="flex items-start p-3 border border-gray-300 dark:border-gray-600 rounded-md cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                    <input
                      type="radio"
                      name="samplingStrategy"
                      value="random"
                      checked={config.samplingStrategy === 'random'}
                      onChange={(e) => setConfig(prev => ({ ...prev, samplingStrategy: e.target.value as 'random' }))}
                      className="mt-0.5 mr-3"
                    />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">Random Sampling</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Randomly select samples from the filtered pool</div>
                    </div>
                  </label>
                  <label className="flex items-start p-3 border border-gray-300 dark:border-gray-600 rounded-md cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                    <input
                      type="radio"
                      name="samplingStrategy"
                      value="stratified"
                      checked={config.samplingStrategy === 'stratified'}
                      onChange={(e) => setConfig(prev => ({ ...prev, samplingStrategy: e.target.value as 'stratified' }))}
                      className="mt-0.5 mr-3"
                    />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">Stratified Sampling</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Distribute samples evenly across quality ranges</div>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <div className="mt-6 flex justify-between">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-white rounded-md hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!canProceedToStep3}
                className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                Next: Review & Create →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Review & Create */}
        {step === 3 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Step 3: Review & Create
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Review your experiment configuration before creating.
            </p>

            <div className="space-y-6">
              {/* Experiment Details */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Experiment Details</h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-600 dark:text-gray-400">Name:</dt>
                    <dd className="font-medium text-gray-900 dark:text-white">{config.name}</dd>
                  </div>
                  {config.description && (
                    <div className="flex justify-between">
                      <dt className="text-gray-600 dark:text-gray-400">Description:</dt>
                      <dd className="font-medium text-gray-900 dark:text-white">{config.description}</dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-gray-600 dark:text-gray-400">Type:</dt>
                    <dd className="font-medium text-gray-900 dark:text-white capitalize">{config.type.replace('_', ' ')}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600 dark:text-gray-400">Number of Sets:</dt>
                    <dd className="font-medium text-gray-900 dark:text-white">{config.numberOfSets} sets (4 images each)</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600 dark:text-gray-400">Total Samples:</dt>
                    <dd className="font-medium text-gray-900 dark:text-white">{config.numberOfSets * 4} samples</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600 dark:text-gray-400">Sampling Strategy:</dt>
                    <dd className="font-medium text-gray-900 dark:text-white capitalize">{config.samplingStrategy}</dd>
                  </div>
                </dl>
              </div>

              {/* Filter Summary */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Sample Pool Filters</h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-600 dark:text-gray-400">Matching Samples:</dt>
                    <dd className="font-medium text-green-600 dark:text-green-400">{matchingCount} available</dd>
                  </div>
                  {filters.studyNumbers.length > 0 && (
                    <div className="flex justify-between">
                      <dt className="text-gray-600 dark:text-gray-400">Studies:</dt>
                      <dd className="font-medium text-gray-900 dark:text-white">{filters.studyNumbers.join(', ')}</dd>
                    </div>
                  )}
                  {filters.minoLRange && (
                    <div className="flex justify-between">
                      <dt className="text-gray-600 dark:text-gray-400">L* Range:</dt>
                      <dd className="font-medium text-gray-900 dark:text-white">{filters.minoLRange.min} - {filters.minoLRange.max}</dd>
                    </div>
                  )}
                  {filters.minoARange && (
                    <div className="flex justify-between">
                      <dt className="text-gray-600 dark:text-gray-400">a* Range:</dt>
                      <dd className="font-medium text-gray-900 dark:text-white">{filters.minoARange.min} - {filters.minoARange.max}</dd>
                    </div>
                  )}
                  {filters.minoBRange && (
                    <div className="flex justify-between">
                      <dt className="text-gray-600 dark:text-gray-400">b* Range:</dt>
                      <dd className="font-medium text-gray-900 dark:text-white">{filters.minoBRange.min} - {filters.minoBRange.max}</dd>
                    </div>
                  )}
                  {filters.colorRange && (
                    <div className="flex justify-between">
                      <dt className="text-gray-600 dark:text-gray-400">Color Score:</dt>
                      <dd className="font-medium text-gray-900 dark:text-white">{filters.colorRange.min} - {filters.colorRange.max}</dd>
                    </div>
                  )}
                  {filters.marblingRange && (
                    <div className="flex justify-between">
                      <dt className="text-gray-600 dark:text-gray-400">Marbling Score:</dt>
                      <dd className="font-medium text-gray-900 dark:text-white">{filters.marblingRange.min} - {filters.marblingRange.max}</dd>
                    </div>
                  )}
                  {filters.firmnessRange && (
                    <div className="flex justify-between">
                      <dt className="text-gray-600 dark:text-gray-400">Firmness Score:</dt>
                      <dd className="font-medium text-gray-900 dark:text-white">{filters.firmnessRange.min} - {filters.firmnessRange.max}</dd>
                    </div>
                  )}
                  {filters.phRange && (
                    <div className="flex justify-between">
                      <dt className="text-gray-600 dark:text-gray-400">pH Range:</dt>
                      <dd className="font-medium text-gray-900 dark:text-white">{filters.phRange.min} - {filters.phRange.max}</dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>

            {/* Navigation */}
            <div className="mt-6 flex justify-between">
              <button
                onClick={() => setStep(2)}
                className="px-6 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-white rounded-md hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleCreateExperiment}
                disabled={loading}
                className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {loading ? 'Creating...' : 'Create Experiment'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
