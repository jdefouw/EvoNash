import { NextRequest, NextResponse } from 'next/server'
import { readFileSync, existsSync, statSync, mkdirSync } from 'fs'
import { join } from 'path'

// Force dynamic rendering since we're building files
export const dynamic = 'force-dynamic'

// Use /tmp directory for Vercel (writable) or dist directory for local
const DIST_DIR = process.env.VERCEL 
  ? join('/tmp', 'evonash-worker')
  : join(process.cwd(), '..', 'dist')

const ZIP_NAME = 'evonash-worker-windows.zip'
const ZIP_PATH = join(DIST_DIR, ZIP_NAME)

// Maximum age for cached zip (1 hour)
const MAX_CACHE_AGE_MS = 60 * 60 * 1000

async function buildWorkerZip(): Promise<Buffer> {
  try {
    // Ensure dist directory exists
    if (!existsSync(DIST_DIR)) {
      mkdirSync(DIST_DIR, { recursive: true })
    }

    // Import and run the packaging script
    const scriptPath = join(process.cwd(), 'scripts', 'package-worker.js')
    
    if (!existsSync(scriptPath)) {
      throw new Error(`Packaging script not found: ${scriptPath}`)
    }
    
    console.log('[WORKER-DOWNLOAD] Building worker zip...')
    console.log(`[WORKER-DOWNLOAD] Script: ${scriptPath}`)
    console.log(`[WORKER-DOWNLOAD] Output: ${ZIP_PATH}`)
    
    // Override the output directory in the script via environment variable
    const originalDistDir = process.env.EVONASH_DIST_DIR
    process.env.EVONASH_DIST_DIR = DIST_DIR
    
    try {
      // Use dynamic import to run the script
      const { packageWorker } = require(scriptPath)
      await packageWorker()
    } finally {
      // Restore original value
      if (originalDistDir) {
        process.env.EVONASH_DIST_DIR = originalDistDir
      } else {
        delete process.env.EVONASH_DIST_DIR
      }
    }
    
    // Read the zip file
    if (!existsSync(ZIP_PATH)) {
      throw new Error(`Zip file was not created at: ${ZIP_PATH}`)
    }
    
    const zipBuffer = readFileSync(ZIP_PATH)
    console.log(`[WORKER-DOWNLOAD] Zip file created: ${(zipBuffer.length / 1024 / 1024).toFixed(2)} MB`)
    
    return zipBuffer
  } catch (error) {
    console.error('[WORKER-DOWNLOAD] Error building zip:', error)
    throw error
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check if zip exists and is recent
    let shouldRebuild = true
    if (existsSync(ZIP_PATH)) {
      try {
        const stats = statSync(ZIP_PATH)
        const age = Date.now() - stats.mtimeMs
        if (age < MAX_CACHE_AGE_MS) {
          shouldRebuild = false
          console.log('[WORKER-DOWNLOAD] Using cached zip file')
        } else {
          console.log('[WORKER-DOWNLOAD] Cached zip is stale, rebuilding...')
        }
      } catch (error) {
        // If we can't stat the file, rebuild
        console.log('[WORKER-DOWNLOAD] Could not stat zip file, rebuilding...')
      }
    }
    
    // Build or read the zip
    const zipBuffer = shouldRebuild 
      ? await buildWorkerZip()
      : readFileSync(ZIP_PATH)
    
    // Return as download
    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${ZIP_NAME}"`,
        'Content-Length': zipBuffer.length.toString(),
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    })
  } catch (error) {
    console.error('[WORKER-DOWNLOAD] Error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to build worker package',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
