'use client'

import { useState, FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

// Disable static generation for this page
export const dynamic = 'force-dynamic'

type AdminCheck = {
  email: string
  is_active: boolean
}

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const supabase = createClient()

    // Validate @illinois.edu domain client-side
    if (!email.endsWith('@illinois.edu')) {
      setMessage('Please use your @illinois.edu email address')
      setLoading(false)
      return
    }

    try {
      // Check if email is in admin whitelist
      const { data: adminUser, error: checkError } = await supabase
        .from('admin_users')
        .select('email, is_active')
        .eq('email', email)
        .single() as { data: AdminCheck | null, error: any }

      if (checkError) {
        console.error('Whitelist check error:', checkError)
        setMessage(`Error checking whitelist: ${checkError.message || 'Unknown error'}`)
        setLoading(false)
        return
      }

      if (!adminUser) {
        console.log('No admin user found for:', email)
        setMessage('This email is not authorized. Please contact an administrator.')
        setLoading(false)
        return
      }

      if (!adminUser.is_active) {
        setMessage('This account has been deactivated. Please contact an administrator.')
        setLoading(false)
        return
      }

      // Send magic link
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/admin/dashboard`,
        },
      })

      if (error) throw error

      setMessage('Check your email for the login link!')
    } catch (error) {
      setMessage('Error sending login link. Please try again.')
      console.error('Login error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-lg">
        <div>
          <h2 className="text-center text-3xl font-bold text-gray-900">
            MSL-Tender Admin
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Sign in with your @illinois.edu email
          </p>
        </div>
        
        <form onSubmit={handleLogin} className="mt-8 space-y-6">
          <div>
            <label htmlFor="email" className="sr-only">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500 focus:z-10 sm:text-sm"
              placeholder="your.email@illinois.edu"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Sending...' : 'Send Magic Link'}
          </button>

          {message && (
            <div className={`rounded-md p-4 ${
              message.includes('Check your email') 
                ? 'bg-green-50 text-green-800 border border-green-200' 
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              <p className="text-sm text-center">{message}</p>
            </div>
          )}
        </form>

        <div className="text-center text-xs text-gray-500">
          <p>Passwordless authentication via magic link</p>
          <p className="mt-1">Admin access is restricted to whitelisted @illinois.edu addresses</p>
        </div>
      </div>
    </div>
  )
}
