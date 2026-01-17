import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerClient()
    
    const { data, error } = await supabase
      .from('experiments')
      .select('status')
      .eq('id', params.id)
      .single()
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    if (!data) {
      return NextResponse.json({ error: 'Experiment not found' }, { status: 404 })
    }
    
    return NextResponse.json({ status: data.status })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch experiment status' },
      { status: 500 }
    )
  }
}
