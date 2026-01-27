import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

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
    const supabase = await createServerClient()

    const { data: rows, error: fetchError } = await supabase
      .from('workers')
      .select('id')

    if (fetchError) {
      console.error('[WORKERS/CLEAR] Fetch error:', fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    const ids = (rows || []).map((r: { id: string }) => r.id)
    if (ids.length === 0) {
      return NextResponse.json({
        success: true,
        deleted_count: 0,
        message: 'No workers to remove',
      })
    }

    const { error: deleteError } = await supabase
      .from('workers')
      .delete()
      .in('id', ids)

    if (deleteError) {
      console.error('[WORKERS/CLEAR] Delete error:', deleteError)
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

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
