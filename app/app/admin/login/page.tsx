'use client'

import { useState, useEffect } from 'react'
import { login } from './actions'

export const dynamic = 'force-dynamic'

export default function AdminLogin() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes('error=')) {
      const params = new URLSearchParams(hash.substring(1))
      const error = params.get('error')
      const errorDescription = params.get('error_description')
      console.error('Auth error from URL:', error, errorDescription)
      setMessage(Authentication error: )
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setMessage('')

    const formData = new FormData(event.currentTarget)

    try {
      const result = await login(formData)
      
      if (result?.error) {
        setMessage(result.error)
        setLoading(false)
      }
      // If successful, redirect() in the server action will handle navigation
    } catch (error) {
      console.error('Login error:', error)
      setMessage('An unexpected error occurred. Please try again.')
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
        
        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
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
              className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500 focus:z-10 sm:text-sm"
              placeholder="Password"
            />
          </div>

          {message && (
            <div
              className={	ext-sm p-3 rounded }
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
