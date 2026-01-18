import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { gunzipSync } from 'zlib'

// Force dynamic rendering since we query the database
export const dynamic = 'force-dynamic'

// Maximum number of checkpoints to keep per experiment
const MAX_CHECKPOINTS = 5

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const supabase = await createServerClient()
    
    // Handle both sync and async params (Next.js 13+ vs 15+)
    const resolvedParams = await Promise.resolve(params)
    const experimentId = resolvedParams.id
    
    const body = await request.json()
    const { generation_number, population_state, population_state_compressed, compressed } = body
    
    if (!generation_number) {
      return NextResponse.json(
        { error: 'generation_number is required' },
        { status: 400 }
      )
    }
    
    // Handle compressed checkpoints (to avoid 413 Payload Too Large errors)
    let finalPopulationState = population_state
    if (compressed && population_state_compressed) {
      try {
        // Validate compressed data exists and is not empty
        if (!population_state_compressed || population_state_compressed.length === 0) {
          return NextResponse.json(
            { error: 'population_state_compressed is empty' },
            { status: 400 }
          )
        }
        
        // Decompress: base64 decode -> gzip decompress -> JSON parse
        const compressedBuffer = Buffer.from(population_state_compressed, 'base64')
        if (compressedBuffer.length === 0) {
          return NextResponse.json(
            { error: 'Failed to decode base64 compressed data' },
            { status: 400 }
          )
        }
        
        const decompressed = gunzipSync(compressedBuffer)
        if (decompressed.length === 0) {
          return NextResponse.json(
            { error: 'Decompressed data is empty' },
            { status: 400 }
          )
        }
        
        finalPopulationState = JSON.parse(decompressed.toString('utf-8'))
        
        // Validate decompressed data structure
        if (!finalPopulationState || typeof finalPopulationState !== 'object') {
          return NextResponse.json(
            { error: 'Decompressed data is not a valid object' },
            { status: 400 }
          )
        }
      } catch (error: any) {
        console.error(`[CHECKPOINT] Error decompressing checkpoint:`, error)
        return NextResponse.json(
          { error: 'Failed to decompress checkpoint data', details: error?.message || String(error) },
          { status: 400 }
        )
      }
    } else if (!population_state) {
      return NextResponse.json(
        { error: 'population_state or population_state_compressed is required' },
        { status: 400 }
      )
    }
    
    // Upsert checkpoint (replace if exists for same generation)
    const { data: checkpoint, error } = await supabase
      .from('experiment_checkpoints')
      .upsert({
        experiment_id: experimentId,
        generation_number,
        population_state: finalPopulationState,
      }, {
        onConflict: 'experiment_id,generation_number'
      })
      .select()
      .single()
    
    if (error) {
      console.error(`[CHECKPOINT] Error saving checkpoint:`, error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    // Cleanup old checkpoints (keep only last MAX_CHECKPOINTS)
    const { data: allCheckpoints } = await supabase
      .from('experiment_checkpoints')
      .select('id, generation_number')
      .eq('experiment_id', experimentId)
      .order('generation_number', { ascending: false })
    
    if (allCheckpoints && allCheckpoints.length > MAX_CHECKPOINTS) {
      const checkpointsToDelete = allCheckpoints.slice(MAX_CHECKPOINTS)
      const idsToDelete = checkpointsToDelete.map(c => c.id)
      
      await supabase
        .from('experiment_checkpoints')
        .delete()
        .in('id', idsToDelete)
      
      console.log(`[CHECKPOINT] Cleaned up ${idsToDelete.length} old checkpoints`)
    }
    
    console.log(`[CHECKPOINT] Saved checkpoint for experiment ${experimentId}, generation ${generation_number}`)
    
    return NextResponse.json({
      success: true,
      checkpoint_id: checkpoint.id,
      generation_number: checkpoint.generation_number
    })
  } catch (error: any) {
    console.error(`[CHECKPOINT] Unexpected error:`, error)
    return NextResponse.json(
      { error: 'Failed to save checkpoint', details: error?.message || String(error) },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const supabase = await createServerClient()
    
    // Handle both sync and async params
    const resolvedParams = await Promise.resolve(params)
    const experimentId = resolvedParams.id
    
    const url = new URL(request.url)
    const generation_number = url.searchParams.get('generation')
    
    let query = supabase
      .from('experiment_checkpoints')
      .select('*')
      .eq('experiment_id', experimentId)
    
    if (generation_number) {
      // Get specific generation checkpoint
      query = query.eq('generation_number', parseInt(generation_number))
    } else {
      // Get latest checkpoint
      query = query.order('generation_number', { ascending: false }).limit(1)
    }
    
    const { data: checkpoints, error } = await query
    
    if (error) {
      console.error(`[CHECKPOINT] Error fetching checkpoint:`, error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    if (!checkpoints || checkpoints.length === 0) {
      return NextResponse.json(
        { error: 'No checkpoint found' },
        { status: 404 }
      )
    }
    
    const checkpoint = checkpoints[0]
    
    return NextResponse.json({
      checkpoint_id: checkpoint.id,
      experiment_id: checkpoint.experiment_id,
      generation_number: checkpoint.generation_number,
      population_state: checkpoint.population_state,
      created_at: checkpoint.created_at
    })
  } catch (error: any) {
    console.error(`[CHECKPOINT] Unexpected error:`, error)
    return NextResponse.json(
      { error: 'Failed to fetch checkpoint', details: error?.message || String(error) },
      { status: 500 }
    )
  }
}
