import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'


// Routes that require authentication
const protectedRoutes = [
  '/dashboard',
  '/matches',
  '/profile',
  '/settings',
]

// Routes hidden from authenticated users
const publicOnlyRoutes = [
  '/login',
  '/register',
]

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname
  const token = request.cookies.get('auth-token')?.value

  const isProtectedRoute = protectedRoutes.some(route => path.startsWith(route))
  const isPublicOnlyRoute = publicOnlyRoutes.some(route => path.startsWith(route))

  // Redirect unauthenticated users from protected routes
  if (isProtectedRoute) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', path)
    if (!token) {
      return NextResponse.redirect(loginUrl)
    }
    try {
      await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET!))
    } catch {
      return NextResponse.redirect(loginUrl)
    }
  }

  // Redirect authenticated users away from public-only routes
  if (token && isPublicOnlyRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

// More specific matcher; skip API and static assets
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)',
  ],
}