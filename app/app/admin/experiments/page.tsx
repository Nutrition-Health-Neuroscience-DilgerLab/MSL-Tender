import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'

type Experiment = {
  id: string
  name: string
  description: string | null
  experiment_type: string
  status: string
  created_at: string
  started_at: string | null
  completed_at: string | null
  sample_count?: number
  response_count?: number
}

export default async function ExperimentsPage() {
  const supabase = await createClient()

  // Check if user is authenticated admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/admin/login')
  }

  // Get all experiments with counts
  const { data: experiments, error } = await supabase
    .from('experiments')
    .select(`
      id,
      name,
      description,
      experiment_type,
      status,
      created_at,
      started_at,
      completed_at
    `)
    .order('created_at', { ascending: false })
    .returns<Experiment[]>()

  if (error) {
    console.error('Error fetching experiments:', error)
  }

  // Get counts for each experiment
  const experimentsWithCounts = await Promise.all(
    (experiments || []).map(async (exp) => {
      const { count: sampleCount } = await supabase
        .from('experiment_samples')
        .select('*', { count: 'exact', head: true })
        .eq('experiment_id', exp.id)

      const { count: responseCount } = await supabase
        .from('responses')
        .select('*', { count: 'exact', head: true })
        .eq('experiment_id', exp.id)

      return {
        ...exp,
        sample_count: sampleCount || 0,
        response_count: responseCount || 0
      }
    })
  )

  const getStatusBadge = (status: string) => {
    const styles = {
      draft: 'bg-gray-100 text-gray-800',
      active: 'bg-green-100 text-green-800',
      completed: 'bg-blue-100 text-blue-800',
      archived: 'bg-yellow-100 text-yellow-800'
    }
    return styles[status as keyof typeof styles] || styles.draft
  }

  const formatDate = (date: string | null) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <Link 
                href="/admin/dashboard"
                className="text-sm text-gray-600 hover:text-gray-900 mb-2 inline-block"
              >
                ← Back to Dashboard
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">Experiments</h1>
              <p className="text-sm text-gray-600 mt-1">
                Manage your sensory evaluation experiments
              </p>
            </div>
            <Link
              href="/admin/experiments/create"
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors font-medium"
            >
              + Create Experiment
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Total Experiments</div>
            <div className="text-2xl font-bold text-gray-900">{experimentsWithCounts.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Active</div>
            <div className="text-2xl font-bold text-green-600">
              {experimentsWithCounts.filter(e => e.status === 'active').length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Completed</div>
            <div className="text-2xl font-bold text-blue-600">
              {experimentsWithCounts.filter(e => e.status === 'completed').length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Draft</div>
            <div className="text-2xl font-bold text-gray-600">
              {experimentsWithCounts.filter(e => e.status === 'draft').length}
            </div>
          </div>
        </div>

        {/* Experiments List */}
        {experimentsWithCounts.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No experiments</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by creating a new experiment.</p>
            <div className="mt-6">
              <Link
                href="/admin/experiments/create"
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
              >
                + Create Experiment
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Experiment Name
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Samples
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Responses
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {experimentsWithCounts.map((experiment) => (
                  <tr key={experiment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{experiment.name}</div>
                      {experiment.description && (
                        <div className="text-sm text-gray-500">{experiment.description}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 capitalize">
                        {experiment.experiment_type.replace(/_/g, ' ')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadge(experiment.status)}`}>
                        {experiment.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {experiment.sample_count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {experiment.response_count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(experiment.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link
                        href={`/admin/experiments/${experiment.id}`}
                        className="text-green-600 hover:text-green-900 mr-4"
                      >
                        View
                      </Link>
                      {experiment.status === 'active' && (
                        <Link
                          href={`/survey/${experiment.id}`}
                          className="text-blue-600 hover:text-blue-900"
                          target="_blank"
                        >
                          Survey Link
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
