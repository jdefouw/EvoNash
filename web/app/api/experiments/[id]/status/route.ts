import { NextRequest, NextResponse } from 'next/server'
import { queryOne } from '@/lib/postgres'

// Force dynamic rendering since we query the database
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const data = await queryOne<{ status: string }>(
      'SELECT status FROM experiments WHERE id = $1',
      [params.id]
    )
    
    if (!data) {
      return NextResponse.json({ error: 'Experiment not found' }, { status: 404 })
    }
    
    return NextResponse.json({ status: data.status })
  } catch (error: any) {
    console.error('Error fetching experiment status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch experiment status' },
      { status: 500 }
    )
  }
}
