import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// Force dynamic rendering since we query the database
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const experiment_id = searchParams.get('experiment_id')
    const generation_number = searchParams.get('generation_number')
    const latest = searchParams.get('latest')
    
    const supabase = await createServerClient()
    
    // Efficient query for last completed generation (single row)
    if (latest === 'true' && experiment_id) {
      const { data, error } = await supabase
        .from('generations')
        .select('generation_number')
        .eq('experiment_id', experiment_id)
        .order('generation_number', { ascending: false })
        .limit(1)
        .single()
      
      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows returned, which is fine (return -1)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      
      return NextResponse.json({ 
        last_completed_generation: data?.generation_number ?? -1 
      })
    }
    
    let query = supabase
      .from('generations')
      .select('*')
      .order('generation_number', { ascending: true })
    
    if (experiment_id) {
      query = query.eq('experiment_id', experiment_id)
    }
    
    if (generation_number) {
      query = query.eq('generation_number', parseInt(generation_number))
    }
    
    const { data, error } = await query
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json(data || [])
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch generations' },
      { status: 500 }
    )
  }
}
