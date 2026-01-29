-- Worker Recovery and Job Assignment Optimization Migration
-- Adds indexes and ensures schema supports persistent worker IDs and job recovery

-- Ensure workers table can accept manual UUIDs (should already work, but making it explicit)
-- The PRIMARY KEY constraint already allows manual UUID insertion, so no change needed

-- Add composite index for common query pattern: job_assignments by experiment_id and status
-- This optimizes the recovery query that filters by both fields
CREATE INDEX IF NOT EXISTS idx_job_assignments_experiment_status 
ON job_assignments(experiment_id, status) 
WHERE status IN ('assigned', 'processing');

-- Add index on assigned_at and started_at for timeout checks in recovery logic
-- This helps with queries that check if assignments are stuck (> 5 minutes)
CREATE INDEX IF NOT EXISTS idx_job_assignments_timestamps 
ON job_assignments(assigned_at, started_at) 
WHERE status IN ('assigned', 'processing');

-- Add composite index for worker_id + status queries (for finding worker's own jobs)
CREATE INDEX IF NOT EXISTS idx_job_assignments_worker_status 
ON job_assignments(worker_id, status) 
WHERE status IN ('assigned', 'processing');

-- Ensure workers.id can be manually set (it's already UUID PRIMARY KEY, so this is just documentation)
-- No actual change needed - UUID PRIMARY KEY columns allow manual insertion

-- Add comment explaining the recovery mechanism
COMMENT ON TABLE job_assignments IS 'Job assignments for distributed processing. Status can be: assigned, processing, completed, failed. Failed assignments can be reassigned.';
COMMENT ON COLUMN job_assignments.assigned_at IS 'When the job was assigned to a worker. Used for timeout detection.';
COMMENT ON COLUMN job_assignments.started_at IS 'When the worker started processing. Used for timeout detection.';
COMMENT ON COLUMN job_assignments.status IS 'Job status: assigned (queued), processing (active), completed (done), failed (can be reassigned)';
