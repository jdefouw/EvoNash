import { NextRequest, NextResponse } from 'next/server'
import { queryAll, query } from '@/lib/postgres'

// Force dynamic rendering since we modify the database
export const dynamic = 'force-dynamic'

/**
 * POST /api/workers/clear
 *
 * Delete all workers from the database.
 * Job assignments referencing workers are cascade-deleted (ON DELETE CASCADE).
 * Use this to remove stale/offline workers from the dashboard.
 */
export async function POST(request: NextRequest) {
  try {
    const rows = await queryAll<{ id: string }>(
      'SELECT id FROM workers'
    )

    const ids = (rows || []).map((r: { id: string }) => r.id)
    if (ids.length === 0) {
      return NextResponse.json({
        success: true,
        deleted_count: 0,
        message: 'No workers to remove',
      })
    }

    // Build placeholders for IN clause
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ')
    
    await query(
      `DELETE FROM workers WHERE id IN (${placeholders})`,
      ids
    )

    console.log(`[WORKERS/CLEAR] Removed ${ids.length} workers`)

    return NextResponse.json({
      success: true,
      deleted_count: ids.length,
      message: `Removed ${ids.length} worker${ids.length === 1 ? '' : 's'}`,
    })
  } catch (error: any) {
    console.error('[WORKERS/CLEAR] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Failed to clear workers', details: error?.message || String(error) },
      { status: 500 }
    )
  }
}
