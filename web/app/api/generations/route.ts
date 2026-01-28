import { NextRequest, NextResponse } from 'next/server'
import { queryAll, queryOne } from '@/lib/postgres'

// Force dynamic rendering since we query the database
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const experiment_id = searchParams.get('experiment_id')
    const generation_number = searchParams.get('generation_number')
    const latest = searchParams.get('latest')
    
    // Efficient query for last completed generation (single row)
    if (latest === 'true' && experiment_id) {
      const data = await queryOne<{ generation_number: number }>(
        `SELECT generation_number FROM generations 
         WHERE experiment_id = $1 
         ORDER BY generation_number DESC 
         LIMIT 1`,
        [experiment_id]
      )
      
      return NextResponse.json({ 
        last_completed_generation: data?.generation_number ?? -1 
      })
    }
    
    // Build query based on filters
    let sql = 'SELECT * FROM generations'
    const params: any[] = []
    const conditions: string[] = []
    
    if (experiment_id) {
      params.push(experiment_id)
      conditions.push(`experiment_id = $${params.length}`)
    }
    
    if (generation_number) {
      params.push(parseInt(generation_number))
      conditions.push(`generation_number = $${params.length}`)
    }
    
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ')
    }
    
    sql += ' ORDER BY generation_number ASC'
    
    const data = await queryAll(sql, params)
    
    return NextResponse.json(data || [])
  } catch (error: any) {
    console.error('Error fetching generations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch generations' },
      { status: 500 }
    )
  }
}
