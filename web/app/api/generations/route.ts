import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const experiment_id = searchParams.get('experiment_id')
    const generation_number = searchParams.get('generation_number')
    
    const supabase = await createServerClient()
    
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
