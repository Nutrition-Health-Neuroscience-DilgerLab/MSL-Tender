import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET() {
  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll()
  
  console.log('[Test Auth] Available cookies:', allCookies.map(c => c.name))

  // Try to create supabase client
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          console.log('[Test Auth] getAll called, returning:', cookieStore.getAll().map(c => c.name))
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          console.log('[Test Auth] setAll called with:', cookiesToSet.map(c => c.name))
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch (e) {
            console.log('[Test Auth] setAll error:', e)
          }
        },
      },
    }
  )

  console.log('[Test Auth] Calling getUser()...')
  const { data: { user }, error } = await supabase.auth.getUser()

  console.log('[Test Auth] Result:')
  console.log('[Test Auth] User:', user?.email || 'NONE')
  console.log('[Test Auth] Error:', error?.message || 'NONE')

  return NextResponse.json({
    availableCookies: allCookies.map(c => c.name),
    getUserResult: {
      user: user?.email || null,
      error: error?.message || null
    }
  })
}
