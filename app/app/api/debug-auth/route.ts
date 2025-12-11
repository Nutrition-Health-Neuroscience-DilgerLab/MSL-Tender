import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET() {
  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll()
  
  // Log all cookies
  console.log('[Debug] All cookies:', allCookies.map(c => ({ name: c.name, valueLength: c.value.length })))
  
  // Find Supabase cookies
  const supabaseCookies = allCookies.filter(c => 
    c.name.includes('supabase') || 
    c.name.includes('sb-') ||
    c.name.includes('auth')
  )
  
  console.log('[Debug] Supabase cookies:', supabaseCookies.map(c => ({ name: c.name, valueLength: c.value.length })))
  
  // Try to get user
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  
  console.log('[Debug] getUser result:', { user: user?.email, error: error?.message })
  
  // Try to get session
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  
  console.log('[Debug] getSession result:', { 
    session: session ? 'Present' : 'Missing', 
    userId: session?.user?.id,
    error: sessionError?.message 
  })
  
  return NextResponse.json({
    cookies: {
      total: allCookies.length,
      names: allCookies.map(c => c.name),
      supabase: supabaseCookies.map(c => ({ name: c.name, valueLength: c.value.length }))
    },
    auth: {
      user: user ? { id: user.id, email: user.email } : null,
      userError: error?.message || null,
      session: session ? { userId: session.user.id, expiresAt: session.expires_at } : null,
      sessionError: sessionError?.message || null
    },
    env: {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      anonKeyFirst20: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 20)
    }
  }, { status: 200 })
}
