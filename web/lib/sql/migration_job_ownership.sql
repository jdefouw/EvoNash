-- Migration: Job Ownership and Worker Tracking Improvements
-- Purpose: Add columns for better job ownership tracking and faster timeout queries
-- Date: 2026-01-25

-- ============================================================================
-- 1. Add last_activity_at to workers table
--    This tracks when a worker last did meaningful work (uploaded results, etc.)
--    Used in conjunction with last_heartbeat for more accurate worker health checks
-- ============================================================================
ALTER TABLE workers ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE;

-- Initialize existing workers with their last_heartbeat as last_activity
UPDATE workers SET last_activity_at = last_heartbeat WHERE last_activity_at IS NULL;

-- Create index for faster timeout queries on last_activity
CREATE INDEX IF NOT EXISTS idx_workers_last_activity ON workers(last_activity_at);

-- ============================================================================
-- 2. Add claimed_at to job_assignments table
--    This tracks when a worker explicitly claimed a job (after the claim endpoint call)
--    Helps distinguish between "assigned but not yet started" and "actively being worked on"
-- ============================================================================
ALTER TABLE job_assignments ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMP WITH TIME ZONE;

-- Create index for queries that check claim time
CREATE INDEX IF NOT EXISTS idx_job_assignments_claimed_at ON job_assignments(claimed_at) 
WHERE claimed_at IS NOT NULL;

-- ============================================================================
-- 3. Add composite index for worker job lookups
--    Speeds up queries that check a worker's active jobs
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_job_assignments_worker_active ON job_assignments(worker_id, status) 
WHERE status IN ('assigned', 'processing');

-- ============================================================================
-- 4. Add release_reason column to track why jobs were released
--    Useful for debugging and understanding job failure patterns
-- ============================================================================
ALTER TABLE job_assignments ADD COLUMN IF NOT EXISTS release_reason TEXT;

-- ============================================================================
-- NOTES:
-- 
-- After running this migration:
-- 1. The worker service will update last_activity_at when uploading results
-- 2. The claim endpoint will set claimed_at when a worker claims a job
-- 3. The release endpoint will set release_reason when a job is released
-- 
-- Recommended timeout values (as implemented in the API routes):
-- - Worker offline: 90 seconds without heartbeat
-- - Job stuck: 5 minutes without progress
-- ============================================================================
