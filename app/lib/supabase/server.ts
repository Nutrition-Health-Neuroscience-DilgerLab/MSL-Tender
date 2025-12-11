import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Database } from '@/types/database.types'

export async function createClient() {
  const cookieStore = await cookies()
  
  console.log('[Server Client] Creating Supabase client')
  console.log('[Server Client] Available cookies:', cookieStore.getAll().map(c => c.name))

  const client = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          const all = cookieStore.getAll()
          console.log('[Server Client] getAll() called, returning:', all.map(c => c.name))
          return all
        },
        setAll(cookiesToSet) {
          console.log('[Server Client] setAll() called with:', cookiesToSet.map(c => c.name))
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch (e) {
            console.log('[Server Client] setAll error (expected in Server Component):', e)
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
  
  console.log('[Server Client] Client created successfully')
  return client
}

