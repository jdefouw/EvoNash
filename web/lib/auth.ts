import { NextRequest, NextResponse } from 'next/server'

/**
 * Simple API key authentication for mutating (write) endpoints.
 * 
 * Protects POST/PUT/DELETE endpoints from unauthorized access.
 * GET (read-only) endpoints remain public for the dashboard.
 * 
 * Usage in API routes:
 *   import { requireAuth } from '@/lib/auth'
 *   
 *   export async function POST(request: NextRequest) {
 *     const authError = requireAuth(request)
 *     if (authError) return authError
 *     // ... rest of handler
 *   }
 * 
 * Workers send the key via header:
 *   Authorization: Bearer <API_KEY>
 * 
 * Set API_SECRET_KEY in .env on the server.
 */

export function requireAuth(request: NextRequest): NextResponse | null {
  const apiKey = process.env.API_SECRET_KEY

  // If no API key is configured, allow all requests (backwards compatible)
  // This ensures existing deployments don't break before the key is set
  if (!apiKey) {
    return null
  }

  const authHeader = request.headers.get('authorization')

  if (!authHeader) {
    return NextResponse.json(
      { error: 'Missing Authorization header' },
      { status: 401 }
    )
  }

  // Support "Bearer <key>" format
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : authHeader

  if (token !== apiKey) {
    return NextResponse.json(
      { error: 'Invalid API key' },
      { status: 403 }
    )
  }

  return null // Auth passed
}
