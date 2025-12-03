'use client'

import { useState, useEffect, FormEvent } from 'react'
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
  const [password, setPassword] = useState('')
  const [authMode, setAuthMode] = useState<'password' | 'magiclink'>('password')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()

  // Check for error in URL hash (from Supabase redirect)
  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes('error=')) {
      const params = new URLSearchParams(hash.substring(1))
      const error = params.get('error')
      const errorDescription = params.get('error_description')
      console.error('Auth error from URL:', error, errorDescription)
      setMessage(`Authentication error: ${errorDescription || error}`)
      // Clear the hash
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])

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
      if (authMode === 'password') {
        // Password-based authentication
        if (!password) {
          setMessage('Please enter your password')
          setLoading(false)
          return
        }

        console.log('[Password Login] Attempting login for:', email)

        // Sign in with password
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) {
          console.error('[Password Login] Error:', error)
          setMessage('Invalid email or password')
          setLoading(false)
          return
        }

        console.log('[Password Login] Success! User:', data.user?.email)
        console.log('[Password Login] Session:', data.session ? 'Present' : 'Missing')
        
        // Check admin_users table
        const { data: adminUser, error: adminError } = await supabase
          .from('admin_users')
          .select('*')
          .eq('id', data.user.id)
          .single()
        
        console.log('[Password Login] Admin user check:', adminUser ? 'Found' : 'Not found', adminError)
        
        if (!adminUser) {
          setMessage('User authenticated but not in admin whitelist. Please contact administrator.')
          setLoading(false)
          return
        }

        console.log('[Password Login] All checks passed, redirecting to dashboard...')
        window.location.href = '/admin/dashboard'
        return
      }

      // Magic link authentication (existing code)
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

      // Send magic link with explicit PKCE flow
      const redirectUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin
      console.log('Sending magic link with redirectUrl:', `${redirectUrl}/auth/callback`)
      
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${redirectUrl}/auth/callback`,
          shouldCreateUser: false, // Don't create new users, only allow whitelisted
        },
      })

      if (error) {
        console.error('Magic link error:', error)
        throw error
      }

      console.log('Magic link sent successfully')
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
          {/* Auth Mode Toggle */}
          <div className="flex justify-center gap-2 p-1 bg-gray-100 rounded-lg">
            <button
              type="button"
              onClick={() => setAuthMode('password')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                authMode === 'password'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Password
            </button>
            <button
              type="button"
              onClick={() => setAuthMode('magiclink')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                authMode === 'magiclink'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Magic Link
            </button>
          </div>

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

          {authMode === 'password' && (
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required={authMode === 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500 focus:z-10 sm:text-sm"
                placeholder="Password"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading 
              ? 'Processing...' 
              : authMode === 'password' 
                ? 'Sign In' 
                : 'Send Magic Link'
            }
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
          <p>
            {authMode === 'password' 
              ? 'Password authentication for whitelisted @illinois.edu addresses'
              : 'Passwordless authentication via magic link'
            }
          </p>
          <p className="mt-1">Admin access is restricted to whitelisted @illinois.edu addresses</p>
        </div>
      </div>
    </div>
  )
}
