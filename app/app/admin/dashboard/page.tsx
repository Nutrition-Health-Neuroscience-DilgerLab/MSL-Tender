'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

type AdminUser = {
  email: string
  full_name: string | null
  role: string
  last_login: string | null
}

export default async function AdminDashboard() {
  try {
    console.log('[Dashboard Page] ===== RENDERING PAGE =====')
    
    const supabase = await createClient()
    console.log('[Dashboard Page] Supabase client created')
    
    console.log('[Dashboard Page] Calling getUser()...')
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    console.log('[Dashboard Page] User result:', user?.email || 'NULL')
    console.log('[Dashboard Page] Error result:', userError?.message || 'NONE')
    
    if (!user) {
      console.log('[Dashboard Page] ❌ NO USER - REDIRECTING TO LOGIN')
      redirect('/admin/login')
    }
    
    console.log('[Dashboard Page] ✓ User authenticated:', user.email)

    // Check if user is an active admin
    const { data: adminUserData, error: adminError } = await supabase
      .from('admin_users')
      .select('email, full_name, role, last_login')
      .eq('id', user.id)
      .single<AdminUser>()

    console.log('[Dashboard Page] Admin query result:', adminUserData?.email || 'NULL', 'Error:', adminError?.message || 'NONE')
    
    if (!adminUserData) {
      console.log('[Dashboard Page] ❌ USER NOT ADMIN - REDIRECTING TO LOGIN')
      redirect('/admin/login')
    }
  
    const adminUser = adminUserData
    console.log('[Dashboard Page] ✓ User is admin, rendering dashboard')

    // Get counts for dashboard stats
    const [samplesResult, experimentsResult] = await Promise.all([
      supabase.from('pork_samples').select('id', { count: 'exact', head: true }),
      supabase.from('experiments').select('id', { count: 'exact', head: true })
    ])

    const totalSamples = samplesResult.count || 0
    const totalExperiments = experimentsResult.count || 0

    return (
      <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">MSL-Tender Admin Dashboard</h1>
              <p className="text-sm text-gray-600 mt-1">
                Welcome, {adminUser.full_name || adminUser.email}
              </p>
            </div>
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-green-500 rounded-md p-3">
                <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Samples</dt>
                  <dd className="text-3xl font-semibold text-gray-900">{totalSamples}</dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-blue-500 rounded-md p-3">
                <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Experiments</dt>
                  <dd className="text-3xl font-semibold text-gray-900">{totalExperiments}</dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-purple-500 rounded-md p-3">
                <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Your Role</dt>
                  <dd className="text-3xl font-semibold text-gray-900 capitalize">{adminUser.role.replace('_', ' ')}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <a
              href="/admin/samples"
              className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-green-500 transition-colors group"
            >
              <div className="flex-shrink-0">
                <svg className="h-8 w-8 text-gray-400 group-hover:text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-900">Browse Samples</p>
                <p className="text-xs text-gray-500">View all pork samples</p>
              </div>
            </a>

            <a
              href="/admin/experiments/create"
              className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-green-500 transition-colors group"
            >
              <div className="flex-shrink-0">
                <svg className="h-8 w-8 text-gray-400 group-hover:text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-900">Create Experiment</p>
                <p className="text-xs text-gray-500">Start new survey</p>
              </div>
            </a>

            <a
              href="/admin/experiments"
              className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-green-500 transition-colors group"
            >
              <div className="flex-shrink-0">
                <svg className="h-8 w-8 text-gray-400 group-hover:text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-900">View Experiments</p>
                <p className="text-xs text-gray-500">Manage all surveys</p>
              </div>
            </a>

            {adminUser.role === 'super_admin' && (
              <a
                href="/admin/users"
                className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-green-500 transition-colors group"
              >
                <div className="flex-shrink-0">
                  <svg className="h-8 w-8 text-gray-400 group-hover:text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-900">Manage Users</p>
                  <p className="text-xs text-gray-500">Admin whitelist</p>
                </div>
              </a>
            )}
          </div>
        </div>

        {/* Getting Started Guide */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">Getting Started</h3>
          <ol className="space-y-2 text-sm text-blue-800">
            <li className="flex items-start">
              <span className="font-semibold mr-2">1.</span>
              <span>Browse the sample library to view all 1,490 pork samples with their sensory data</span>
            </li>
            <li className="flex items-start">
              <span className="font-semibold mr-2">2.</span>
              <span>Create a new experiment by selecting samples (multiples of 4) for side-by-side comparison</span>
            </li>
            <li className="flex items-start">
              <span className="font-semibold mr-2">3.</span>
              <span>Share the unique survey link with participants to collect responses</span>
            </li>
            <li className="flex items-start">
              <span className="font-semibold mr-2">4.</span>
              <span>View results and export response data for analysis</span>
            </li>
          </ol>
        </div>
      </main>
    </div>
    )
  } catch (error) {
    console.error('[Dashboard Page] EXCEPTION CAUGHT:', error)
    console.error('[Dashboard Page] Error details:', JSON.stringify(error, null, 2))
    throw error
  }
}
