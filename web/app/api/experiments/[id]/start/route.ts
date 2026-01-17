import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerClient()
    
    const { error } = await supabase
      .from('experiments')
      .update({ status: 'RUNNING' })
      .eq('id', params.id)
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ success: true, status: 'RUNNING' })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to start experiment' },
      { status: 500 }
    )
  }
}
