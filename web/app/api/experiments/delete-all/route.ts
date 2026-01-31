import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/postgres'

// Force dynamic rendering since we modify the database
export const dynamic = 'force-dynamic'

const DELETE_ALL_KEYWORD = 'sciencefair2026'

/**
 * DELETE /api/experiments/delete-all
 * 
 * Deletes ALL experiments and their related data.
 * Requires request body: { keyword: "sciencefair2026" } to confirm.
 * This is a destructive operation that cannot be undone.
 */
export async function DELETE(request: NextRequest) {
  try {
    let body: { keyword?: string } = {}
    try {
      body = await request.json()
    } catch {
      // No body or invalid JSON
    }
    if (body.keyword !== DELETE_ALL_KEYWORD) {
      return NextResponse.json(
        { error: 'Invalid or missing keyword. Deletion not allowed.' },
        { status: 403 }
      )
    }

    console.log('[DELETE-ALL] Starting deletion of all experiments...')
    
    // Get count before deletion for reporting
    const countResult = await query('SELECT COUNT(*) as count FROM experiments')
    const experimentCount = parseInt(countResult.rows[0]?.count || '0')
    
    if (experimentCount === 0) {
      return NextResponse.json({
        success: true,
        message: 'No experiments to delete',
        deleted_count: 0
      })
    }
    
    console.log(`[DELETE-ALL] Found ${experimentCount} experiments to delete`)
    
    // Delete in order to respect foreign key constraints
    // Order: matches -> agents -> checkpoints -> jobs -> generations -> experiments
    
    // 1. Delete matches (references agents, generations, experiments)
    let matchesDeleted = 0
    try {
      const matchesResult = await query('DELETE FROM matches RETURNING id')
      matchesDeleted = matchesResult.rows?.length || 0
      console.log(`[DELETE-ALL] Deleted ${matchesDeleted} matches`)
    } catch (e) {
      console.log('[DELETE-ALL] No matches table or already empty')
    }
    
    // 2. Delete agents (references generations, experiments)
    let agentsDeleted = 0
    try {
      const agentsResult = await query('DELETE FROM agents RETURNING id')
      agentsDeleted = agentsResult.rows?.length || 0
      console.log(`[DELETE-ALL] Deleted ${agentsDeleted} agents`)
    } catch (e) {
      console.log('[DELETE-ALL] No agents table or already empty')
    }
    
    // 3. Delete experiment_checkpoints
    let checkpointsDeleted = 0
    try {
      const checkpointsResult = await query('DELETE FROM experiment_checkpoints RETURNING id')
      checkpointsDeleted = checkpointsResult.rows?.length || 0
      console.log(`[DELETE-ALL] Deleted ${checkpointsDeleted} checkpoints`)
    } catch (e) {
      console.log('[DELETE-ALL] No experiment_checkpoints table or already empty')
    }
    
    // 4. Delete job assignments
    const jobsResult = await query('DELETE FROM job_assignments RETURNING id')
    const jobsDeleted = jobsResult.rows?.length || 0
    console.log(`[DELETE-ALL] Deleted ${jobsDeleted} job assignments`)
    
    // 5. Delete generations (this includes all generation data)
    const generationsResult = await query('DELETE FROM generations RETURNING id')
    const generationsDeleted = generationsResult.rows?.length || 0
    console.log(`[DELETE-ALL] Deleted ${generationsDeleted} generations`)
    
    // 6. Delete experiments
    const experimentsResult = await query('DELETE FROM experiments RETURNING id')
    const experimentsDeleted = experimentsResult.rows?.length || 0
    console.log(`[DELETE-ALL] Deleted ${experimentsDeleted} experiments`)
    
    console.log('[DELETE-ALL] ✓ All experiments deleted successfully')
    
    return NextResponse.json({
      success: true,
      message: 'All experiments deleted successfully',
      deleted_count: experimentsDeleted,
      details: {
        experiments: experimentsDeleted,
        generations: generationsDeleted,
        job_assignments: jobsDeleted,
        checkpoints: checkpointsDeleted,
        agents: agentsDeleted,
        matches: matchesDeleted
      }
    })
  } catch (error) {
    console.error('[DELETE-ALL] Error deleting all experiments:', error)
    return NextResponse.json(
      { 
        error: 'Failed to delete all experiments',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
