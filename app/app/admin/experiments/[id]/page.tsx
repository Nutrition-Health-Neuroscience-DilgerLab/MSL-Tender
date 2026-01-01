/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import Image from 'next/image'

type Experiment = {
  id: string
  name: string
  description: string | null
  experiment_type: string
  num_images: number
  status: string
  randomize_order: boolean
  collect_timing: boolean
  collect_click_data: boolean
  instructions: string | null
  created_at: string
  started_at: string | null
  completed_at: string | null
}

type ExperimentSample = {
  id: string
  sample_id: string
  display_order: number | null
  set_number: number | null
  sample: {
    standardized_chop_id: string
    study_number: number
    chop_color: number | null
    chop_marbling: number | null
  }
  image_url?: string
}

export default async function ExperimentDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/admin/login')
  }

  // Get experiment details
  const { data: experiment, error: expError } = await supabase
    .from('experiments')
    .select('*')
    .eq('id', id)
    .single<Experiment>()

  if (expError || !experiment) {
    notFound()
  }

  // Get experiment samples
  const { data: experimentSamples } = await supabase
    .from('experiment_samples')
    .select(`
      id,
      sample_id,
      sample_order,
      pork_samples!inner (
        standardized_chop_id,
        study_number,
        chop_color,
        chop_marbling
      )
    `)
    .eq('experiment_id', id)
    .order('sample_order', { ascending: true })

  // Get images for samples
  const sampleIds = experimentSamples?.map((es: any) => es.sample_id) || []
  const { data: images } = await supabase
    .from('sample_images')
    .select('sample_id, image_url')
    .in('sample_id', sampleIds)

  const imageMap = new Map(
    images?.map((img: any) => [img.sample_id, img.image_url]) || []
  )

  // Transform the data
  const samplesWithImages: ExperimentSample[] = experimentSamples?.map((es: any) => ({
    id: es.id,
    sample_id: es.sample_id,
    display_order: es.sample_order,
    set_number: Math.floor((es.sample_order || 0) / 4),
    sample: Array.isArray(es.pork_samples) ? es.pork_samples[0] : es.pork_samples,
    image_url: imageMap.get(es.sample_id)
  })) || []

  // Get response count
  const { count: responseCount } = await supabase
    .from('responses')
    .select('*', { count: 'exact', head: true })
    .eq('experiment_id', id)

  // Group by sets
  const sets = new Map<number, ExperimentSample[]>()
  samplesWithImages.forEach(sample => {
    const setNum = sample.set_number ?? 0
    if (!sets.has(setNum)) {
      sets.set(setNum, [])
    }
    sets.get(setNum)!.push(sample)
  })

  const getStatusBadge = (status: string) => {
    const styles = {
      draft: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Draft' },
      active: { bg: 'bg-green-100', text: 'text-green-800', label: 'Active' },
      completed: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Completed' },
      archived: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Archived' }
    }
    return styles[status as keyof typeof styles] || styles.draft
  }

  const formatDate = (date: string | null) => {
    if (!date) return 'Not set'
    const d = new Date(date)
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  }

  const statusInfo = getStatusBadge(experiment.status)
  const surveyUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/survey/${experiment.id}`

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link 
            href="/admin/experiments"
            className="text-sm text-gray-600 hover:text-gray-900 mb-2 inline-block"
          >
            ← Back to Experiments
          </Link>
          
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">{experiment.name}</h1>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusInfo.bg} ${statusInfo.text}`}>
                  {statusInfo.label}
                </span>
              </div>
              {experiment.description && (
                <p className="text-gray-600 mt-2">{experiment.description}</p>
              )}
            </div>
            <div className="flex gap-3">
              <Link
                href={`/admin/experiments/${experiment.id}/preview`}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
              >
                Preview Survey
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Total Samples</div>
            <div className="text-2xl font-bold text-gray-900">{samplesWithImages.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Sets of 4</div>
            <div className="text-2xl font-bold text-gray-900">{sets.size}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Responses</div>
            <div className="text-2xl font-bold text-green-600">{responseCount || 0}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Type</div>
            <div className="text-lg font-bold text-gray-900 capitalize">
              {experiment.experiment_type.replace(/_/g, ' ')}
            </div>
          </div>
        </div>

        {/* Experiment Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Configuration</h2>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-gray-600">Experiment Type</dt>
                  <dd className="font-medium text-gray-900 capitalize mt-1">
                    {experiment.experiment_type.replace(/_/g, ' ')}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-600">Images per Set</dt>
                  <dd className="font-medium text-gray-900 mt-1">{experiment.num_images}</dd>
                </div>
                <div>
                  <dt className="text-gray-600">Randomize Order</dt>
                  <dd className="font-medium text-gray-900 mt-1">
                    {experiment.randomize_order ? 'Yes' : 'No'}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-600">Collect Timing Data</dt>
                  <dd className="font-medium text-gray-900 mt-1">
                    {experiment.collect_timing ? 'Yes' : 'No'}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-600">Collect Click Data</dt>
                  <dd className="font-medium text-gray-900 mt-1">
                    {experiment.collect_click_data ? 'Yes' : 'No'}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-600">Status</dt>
                  <dd className="font-medium text-gray-900 mt-1">{statusInfo.label}</dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Timeline</h2>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-gray-600">Created</dt>
                  <dd className="font-medium text-gray-900 mt-1">{formatDate(experiment.created_at)}</dd>
                </div>
                <div>
                  <dt className="text-gray-600">Started</dt>
                  <dd className="font-medium text-gray-900 mt-1">{formatDate(experiment.started_at)}</dd>
                </div>
                <div>
                  <dt className="text-gray-600">Completed</dt>
                  <dd className="font-medium text-gray-900 mt-1">{formatDate(experiment.completed_at)}</dd>
                </div>
              </dl>

              {experiment.status === 'active' && (
                <div className="mt-6 pt-6 border-t">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Survey Link
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={surveyUrl}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-50"
                    />
                    <button
                      onClick={() => navigator.clipboard.writeText(surveyUrl)}
                      className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
                    >
                      Copy
                    </button>
                  </div>
                  <a
                    href={surveyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 text-sm text-green-600 hover:text-green-700 inline-block"
                  >
                    Open survey →
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sample Sets */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Sample Sets</h2>
            <p className="text-sm text-gray-600 mt-1">
              {sets.size} sets of {experiment.num_images} images each
            </p>
          </div>
          
          <div className="p-6 space-y-8">
            {Array.from(sets.entries()).map(([setNum, setsamples]) => (
              <div key={setNum}>
                <h3 className="text-sm font-medium text-gray-700 mb-3">
                  Set {setNum + 1}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {setsamples.map((sample) => (
                    <div key={sample.id} className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="aspect-square bg-gray-100 relative">
                        {sample.image_url ? (
                          <Image
                            src={sample.image_url}
                            alt={sample.sample.standardized_chop_id}
                            fill
                            className="object-cover"
                            sizes="(max-width: 768px) 50vw, 25vw"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
                            No image
                          </div>
                        )}
                      </div>
                      <div className="p-3 bg-white">
                        <div className="text-sm font-semibold text-gray-900">
                          {sample.sample.standardized_chop_id}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Study {sample.sample.study_number}
                        </div>
                        {sample.sample.chop_color !== null && (
                          <div className="text-xs text-gray-600 mt-1">
                            Color: {sample.sample.chop_color}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
