'use client'

import { useState, useEffect } from 'react'

export const dynamic = 'force-dynamic'

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes('error=')) {
      const params = new URLSearchParams(hash.substring(1))
      const error = params.get('error')
      const errorDescription = params.get('error_description')
      console.error('Auth error from URL:', error, errorDescription)
      // Use setTimeout to avoid setState in effect body
      setTimeout(() => {
        setMessage(`Authentication error: ${errorDescription || error}`)
      }, 0)
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      console.log('[Login Page] Calling /api/auth/login for:', email)

      // Call the API endpoint which handles server-side auth
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('[Login Page] API error:', data.error)
        setMessage(data.error || 'Authentication failed')
        setLoading(false)
        return
      }

      console.log('[Login Page] API success! User:', data.user)
      console.log('[Login Page] Redirecting to:', data.redirectUrl)

      // Redirect to dashboard - the cookies are now set server-side
      window.location.href = data.redirectUrl
    } catch (error) {
      setMessage('An unexpected error occurred. Please try again.')
      console.error('Login error:', error)
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

          <div>
            <label htmlFor="password" className="sr-only">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500 focus:z-10 sm:text-sm"
              placeholder="Password"
            />
          </div>

          {message && (
            <div
              className={`text-sm p-3 rounded ${
                message.includes('error') || message.includes('Invalid')
                  ? 'bg-red-50 text-red-800 border border-red-200'
                  : 'bg-green-50 text-green-800 border border-green-200'
              }`}
            >
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="text-center">
          <p className="text-xs text-gray-500">
            Password-based authentication for @illinois.edu accounts
          </p>
        </div>
      </div>
    </div>
  )
}
