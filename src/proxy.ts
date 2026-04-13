import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const PROTECTED   = ['/dashboard', '/transactions', '/log', '/whatif', '/shopping', '/ask', '/settings', '/migrate']
const AUTH_ONLY   = ['/login', '/signup']
// Routes that require a real account even with the guest cookie
const GUEST_BLOCK = ['/migrate']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isProtected = PROTECTED.some(p => pathname === p || pathname.startsWith(p + '/'))
  const isAuthOnly  = AUTH_ONLY.some(p => pathname === p || pathname.startsWith(p + '/'))

  if (!isProtected && !isAuthOnly) return NextResponse.next()

  // Guest mode: allow access to all protected routes except GUEST_BLOCK
  const isGuest = request.cookies.get('pm_guest')?.value === '1'
  if (isGuest && isProtected) {
    const blocked = GUEST_BLOCK.some(p => pathname === p || pathname.startsWith(p + '/'))
    if (blocked) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return NextResponse.next()
  }

  // Read-only Supabase client — session refresh handled by server components
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll() {
          // No-op in proxy: cookie writes handled downstream by server components
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (isProtected && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (isAuthOnly && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
