import { NextRequest, NextResponse } from 'next/server'
import { query, queryAll, queryOne } from '@/lib/postgres'
import { gunzipSync } from 'zlib'

// Force dynamic rendering since we query the database
export const dynamic = 'force-dynamic'

// Maximum number of checkpoints to keep per experiment
// Increased from 5 to 10 for better recovery options and scientific data integrity
const MAX_CHECKPOINTS = 10

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Handle both sync and async params (Next.js 13+ vs 15+)
    const resolvedParams = await Promise.resolve(params)
    const experimentId = resolvedParams.id
    
    // Handle payload size errors gracefully
    let body
    try {
      body = await request.json()
    } catch (parseError: any) {
      const errorMessage = (parseError?.message || String(parseError)).toLowerCase()
      // Check for various payload size error messages
      if (errorMessage.includes('too large') || 
          errorMessage.includes('413') || 
          errorMessage.includes('payload') ||
          errorMessage.includes('request entity too large') ||
          errorMessage.includes('body size limit') ||
          errorMessage.includes('max body size')) {
        console.error(`[CHECKPOINT] Payload too large error:`, parseError?.message || String(parseError))
        return NextResponse.json(
          { 
            error: 'Payload too large', 
            details: 'The checkpoint data exceeds the maximum allowed size (50MB configured in nginx). Please ensure compression is enabled on the worker.',
            hint: 'Check worker configuration to ensure compression is enabled for checkpoints. If compression is already enabled, consider reducing population size or saving fewer agents in checkpoints.'
          },
          { status: 413 }
        )
      }
      // Re-throw if it's a different error
      throw parseError
    }
    const { generation_number, population_state, population_state_compressed, compressed } = body
    
    // Check if generation_number exists (including 0, which is falsy but valid)
    if (generation_number === undefined || generation_number === null) {
      return NextResponse.json(
        { error: 'generation_number is required' },
        { status: 400 }
      )
    }
    
    // Ensure generation_number is an integer
    const genNum = parseInt(String(generation_number), 10)
    if (isNaN(genNum)) {
      return NextResponse.json(
        { error: 'generation_number must be a valid integer' },
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
    const result = await query(
      `INSERT INTO experiment_checkpoints (experiment_id, generation_number, population_state)
       VALUES ($1, $2, $3)
       ON CONFLICT (experiment_id, generation_number) 
       DO UPDATE SET population_state = $3, created_at = NOW()
       RETURNING *`,
      [experimentId, genNum, JSON.stringify(finalPopulationState)]
    )
    
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Failed to save checkpoint' }, { status: 500 })
    }
    
    const checkpoint = result.rows[0]
    
    // Cleanup old checkpoints (keep only last MAX_CHECKPOINTS)
    const allCheckpoints = await queryAll<{ id: string; generation_number: number }>(
      `SELECT id, generation_number FROM experiment_checkpoints 
       WHERE experiment_id = $1 
       ORDER BY generation_number DESC`,
      [experimentId]
    )
    
    if (allCheckpoints && allCheckpoints.length > MAX_CHECKPOINTS) {
      const checkpointsToDelete = allCheckpoints.slice(MAX_CHECKPOINTS)
      const idsToDelete = checkpointsToDelete.map(c => c.id)
      
      const placeholders = idsToDelete.map((_: string, i: number) => `$${i + 1}`).join(', ')
      await query(
        `DELETE FROM experiment_checkpoints WHERE id IN (${placeholders})`,
        idsToDelete
      )
      
      console.log(`[CHECKPOINT] Cleaned up ${idsToDelete.length} old checkpoints`)
    }
    
    console.log(`[CHECKPOINT] Saved checkpoint for experiment ${experimentId}, generation ${genNum}`)
    
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
    // Handle both sync and async params
    const resolvedParams = await Promise.resolve(params)
    const experimentId = resolvedParams.id
    
    const url = new URL(request.url)
    const generation_number = url.searchParams.get('generation')
    
    let checkpoints
    
    if (generation_number) {
      // Get specific generation checkpoint
      checkpoints = await queryAll(
        `SELECT * FROM experiment_checkpoints 
         WHERE experiment_id = $1 AND generation_number = $2`,
        [experimentId, parseInt(generation_number)]
      )
    } else {
      // Get latest checkpoint
      checkpoints = await queryAll(
        `SELECT * FROM experiment_checkpoints 
         WHERE experiment_id = $1 
         ORDER BY generation_number DESC 
         LIMIT 1`,
        [experimentId]
      )
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
