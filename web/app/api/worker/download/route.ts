import { NextRequest, NextResponse } from 'next/server'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// The zip is pre-built during build time and stored in public directory
const ZIP_NAME = 'evonash-worker-windows.zip'
const ZIP_PATH = join(process.cwd(), 'public', ZIP_NAME)

export async function GET(request: NextRequest) {
  try {
    // Check if the pre-built zip exists
    if (!existsSync(ZIP_PATH)) {
      console.error(`[WORKER-DOWNLOAD] Zip file not found at: ${ZIP_PATH}`)
      return NextResponse.json(
        { 
          error: 'Worker package not available',
          details: 'The worker package was not built during deployment. Please rebuild the application.'
        },
        { status: 404 }
      )
    }
    
    // Read the pre-built zip file
    const zipBuffer = readFileSync(ZIP_PATH)
    console.log(`[WORKER-DOWNLOAD] Serving zip file: ${(zipBuffer.length / 1024 / 1024).toFixed(2)} MB`)
    
    // Convert Buffer to Uint8Array for NextResponse
    const uint8Array = new Uint8Array(zipBuffer)
    
    // Return as download
    return new NextResponse(uint8Array, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${ZIP_NAME}"`,
        'Content-Length': zipBuffer.length.toString(),
        'Cache-Control': 'public, max-age=86400', // Cache for 24 hours (static file)
      },
    })
  } catch (error) {
    console.error('[WORKER-DOWNLOAD] Error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to serve worker package',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
