-- Migration: Atomic Job Count Operations
-- Purpose: Ensure data integrity for distributed CUDA compute jobs
-- by providing atomic increment/decrement of worker job counts
-- 
-- This prevents race conditions where multiple job claims/completions
-- could cause counter drift between the database and worker state.

-- ============================================================================
-- Atomic claim function: Claims a job and increments worker's active_jobs_count
-- ============================================================================
CREATE OR REPLACE FUNCTION claim_job_atomic(
    p_job_id TEXT,
    p_worker_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_claimed BOOLEAN := FALSE;
BEGIN
    -- Atomic claim with counter increment in a single transaction
    -- Only claims if job is still in 'assigned' status for this worker
    UPDATE job_assignments
    SET status = 'processing', 
        started_at = NOW(),
        claimed_at = NOW()
    WHERE job_id = p_job_id 
      AND worker_id = p_worker_id 
      AND status = 'assigned';
    
    IF FOUND THEN
        -- Increment worker's active job count atomically
        UPDATE workers 
        SET active_jobs_count = active_jobs_count + 1,
            status = 'processing',
            last_heartbeat = NOW()
        WHERE id = p_worker_id;
        v_claimed := TRUE;
    END IF;
    
    RETURN v_claimed;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Atomic complete function: Marks job complete and decrements worker's count
-- ============================================================================
CREATE OR REPLACE FUNCTION complete_job_atomic(
    p_job_id TEXT,
    p_worker_id UUID,
    p_status TEXT DEFAULT 'completed'
) RETURNS BOOLEAN AS $$
DECLARE
    v_completed BOOLEAN := FALSE;
BEGIN
    -- Validate status parameter
    IF p_status NOT IN ('completed', 'failed') THEN
        RAISE EXCEPTION 'Invalid status: %. Must be completed or failed', p_status;
    END IF;
    
    -- Atomic completion with counter decrement in a single transaction
    UPDATE job_assignments
    SET status = p_status::job_assignment_status_type, 
        completed_at = NOW()
    WHERE job_id = p_job_id 
      AND worker_id = p_worker_id
      AND status = 'processing';
    
    IF FOUND THEN
        -- Decrement worker's active job count atomically (ensure non-negative)
        UPDATE workers 
        SET active_jobs_count = GREATEST(0, active_jobs_count - 1),
            last_heartbeat = NOW()
        WHERE id = p_worker_id;
        
        -- Update worker status to idle if no more active jobs
        UPDATE workers
        SET status = 'idle'
        WHERE id = p_worker_id
          AND active_jobs_count = 0;
        
        v_completed := TRUE;
    END IF;
    
    RETURN v_completed;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Atomic release function: Releases job back to queue for reassignment
-- Similar to complete but marks as 'failed' to allow reassignment
-- ============================================================================
CREATE OR REPLACE FUNCTION release_job_atomic(
    p_job_id TEXT,
    p_worker_id UUID,
    p_reason TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_released BOOLEAN := FALSE;
BEGIN
    -- Atomic release with counter decrement
    -- Can release jobs in either 'assigned' or 'processing' status
    UPDATE job_assignments
    SET status = 'failed', 
        completed_at = NOW(),
        release_reason = COALESCE(p_reason, 'Released by worker')
    WHERE job_id = p_job_id 
      AND worker_id = p_worker_id
      AND status IN ('assigned', 'processing');
    
    IF FOUND THEN
        -- Decrement worker's active job count atomically (ensure non-negative)
        UPDATE workers 
        SET active_jobs_count = GREATEST(0, active_jobs_count - 1),
            last_heartbeat = NOW()
        WHERE id = p_worker_id;
        
        -- Update worker status to idle if no more active jobs
        UPDATE workers
        SET status = 'idle'
        WHERE id = p_worker_id
          AND active_jobs_count = 0;
        
        v_released := TRUE;
    END IF;
    
    RETURN v_released;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Grant execute permissions to authenticated users
-- ============================================================================
GRANT EXECUTE ON FUNCTION claim_job_atomic(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION complete_job_atomic(TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION release_job_atomic(TEXT, UUID, TEXT) TO authenticated;

-- Also grant to anon for workers that may not have auth
GRANT EXECUTE ON FUNCTION claim_job_atomic(TEXT, UUID) TO anon;
GRANT EXECUTE ON FUNCTION complete_job_atomic(TEXT, UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION release_job_atomic(TEXT, UUID, TEXT) TO anon;
