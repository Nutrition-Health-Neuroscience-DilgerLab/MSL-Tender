import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    // Validate domain
    if (!email.endsWith('@illinois.edu')) {
      return NextResponse.json(
        { error: 'Please use your @illinois.edu email address' },
        { status: 400 }
      )
    }

    const cookieStore = await cookies()

    // Create Supabase client with proper cookie handling
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options)
              })
            } catch (error) {
              // In API route context, cookies() may not support setAll
              console.log('[API Auth] Note: in API route, using response.cookies instead')
            }
          },
        },
      }
    )

    console.log('[API Auth] Attempting login for:', email)

    // Sign in with password
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      console.error('[API Auth] Supabase auth error:', error)
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    console.log('[API Auth] Auth success, user:', data.user?.email)
    console.log('[API Auth] Session:', data.session?.access_token ? 'YES' : 'NO')

    // Verify admin status
    const { data: adminUser, error: adminError } = await supabase
      .from('admin_users')
      .select('*')
      .eq('id', data.user!.id)
      .single()

    if (adminError || !adminUser) {
      console.error('[API Auth] Admin check failed:', adminError)
      return NextResponse.json(
        { error: 'User not authorized as admin' },
        { status: 403 }
      )
    }

    console.log('[API Auth] Admin verified, creating response')

    // Create response with success
    const response = NextResponse.json(
      { 
        success: true, 
        user: data.user?.email,
        redirectUrl: '/admin/dashboard'
      },
      { status: 200 }
    )

    // Manually set all auth cookies on the response
    if (data.session) {
      // Set access token with explicit path to root
      response.cookies.set('sb-access-token', data.session.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 3600,
        path: '/',
      })

      // Set refresh token with explicit path to root
      response.cookies.set('sb-refresh-token', data.session.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 604800,
        path: '/',
      })
    }

    console.log('[API Auth] Response cookies set:', response.cookies.getAll().map(c => c.name))

    return response
  } catch (error) {
    console.error('[API Auth] Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

