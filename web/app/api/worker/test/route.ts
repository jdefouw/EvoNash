import { NextRequest, NextResponse } from 'next/server'

// Force dynamic rendering since we use request.headers
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Log the connection test
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    console.log(`[WORKER_TEST] Connection test from ${clientIp} at ${new Date().toISOString()}`)
    
    return NextResponse.json({ 
      success: true, 
      message: 'Worker connection test successful',
      timestamp: new Date().toISOString(),
      server: 'Vercel',
      endpoint: '/api/worker/test'
    })
  } catch (error) {
    console.error('[WORKER_TEST] Error:', error)
    return NextResponse.json(
      { error: 'Connection test failed' },
      { status: 500 }
    )
  }
}
