import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    return NextResponse.json({ 
      success: true, 
      message: 'Worker connection test successful',
      timestamp: new Date().toISOString(),
      server: 'Vercel'
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Connection test failed' },
      { status: 500 }
    )
  }
}
