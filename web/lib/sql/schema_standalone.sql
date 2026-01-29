-- EvoNash Database Schema for Standalone PostgreSQL
-- This is the complete schema for self-hosted PostgreSQL deployment
-- Run this file to set up the database from scratch

-- ============================================================================
-- ENUMS
-- ============================================================================

-- Create enums (only if they don't exist)
DO $$ BEGIN
    CREATE TYPE experiment_group_type AS ENUM ('CONTROL', 'EXPERIMENTAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE mutation_mode_type AS ENUM ('STATIC', 'ADAPTIVE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE experiment_status_type AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add STOPPED to existing enum if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'STOPPED' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'experiment_status_type')
    ) THEN
        ALTER TYPE experiment_status_type ADD VALUE 'STOPPED';
    END IF;
EXCEPTION
    WHEN OTHERS THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE match_type_enum AS ENUM ('self_play', 'benchmark');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE worker_status_type AS ENUM ('idle', 'processing', 'offline');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE job_assignment_status_type AS ENUM ('assigned', 'processing', 'completed', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- MAIN TABLES
-- ============================================================================

-- Experiments Table
CREATE TABLE IF NOT EXISTS experiments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_name TEXT NOT NULL,
    experiment_group experiment_group_type NOT NULL,
    mutation_mode mutation_mode_type NOT NULL,
    random_seed INTEGER NOT NULL,
    population_size INTEGER NOT NULL,
    max_generations INTEGER NOT NULL,
    status experiment_status_type NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    mutation_rate FLOAT,
    mutation_base FLOAT,
    max_possible_elo FLOAT DEFAULT 2000.0,
    selection_pressure FLOAT DEFAULT 0.2,
    ticks_per_generation INTEGER DEFAULT 750,
    network_architecture JSONB
);

-- Generations Table
CREATE TABLE IF NOT EXISTS generations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    generation_number INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    population_size INTEGER NOT NULL,
    avg_fitness FLOAT,
    avg_elo FLOAT,
    peak_elo FLOAT,
    min_elo FLOAT,
    std_elo FLOAT,
    policy_entropy FLOAT,
    entropy_variance FLOAT,
    win_rate_variance FLOAT,
    population_diversity FLOAT,
    mutation_rate FLOAT,
    min_fitness FLOAT,
    max_fitness FLOAT,
    std_fitness FLOAT,
    UNIQUE(experiment_id, generation_number)
);

-- Agents Table
CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    generation_id UUID NOT NULL REFERENCES generations(id) ON DELETE CASCADE,
    agent_index INTEGER NOT NULL,
    elo_rating FLOAT NOT NULL DEFAULT 1500,
    fitness_score FLOAT,
    network_weights_path TEXT,
    parent_elo FLOAT,
    mutation_rate_applied FLOAT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(experiment_id, generation_id, agent_index)
);

-- Matches Table
CREATE TABLE IF NOT EXISTS matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    generation_id UUID NOT NULL REFERENCES generations(id) ON DELETE CASCADE,
    agent_a_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    agent_b_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    winner_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    match_type match_type_enum NOT NULL,
    move_history JSONB,
    telemetry JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- MULTI-WORKER DISTRIBUTED JOB SHARDING TABLES
-- ============================================================================

-- Workers Table
CREATE TABLE IF NOT EXISTS workers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_name TEXT,
    gpu_type TEXT,
    vram_gb INTEGER NOT NULL,
    max_parallel_jobs INTEGER NOT NULL,
    status worker_status_type NOT NULL DEFAULT 'idle',
    active_jobs_count INTEGER NOT NULL DEFAULT 0,
    last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Job Assignments Table
CREATE TABLE IF NOT EXISTS job_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
    generation_start INTEGER NOT NULL,
    generation_end INTEGER NOT NULL,
    status job_assignment_status_type NOT NULL DEFAULT 'assigned',
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    claimed_at TIMESTAMP WITH TIME ZONE,
    release_reason TEXT,
    job_id TEXT NOT NULL UNIQUE,
    CONSTRAINT valid_generation_range CHECK (generation_end >= generation_start)
);

-- ============================================================================
-- CHECKPOINTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS experiment_checkpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    generation_number INTEGER NOT NULL,
    population_state JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(experiment_id, generation_number)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Experiments
CREATE INDEX IF NOT EXISTS idx_experiments_status ON experiments(status);
CREATE INDEX IF NOT EXISTS idx_experiments_group ON experiments(experiment_group);

-- Generations
CREATE INDEX IF NOT EXISTS idx_generations_experiment_id ON generations(experiment_id);
CREATE INDEX IF NOT EXISTS idx_generations_experiment_generation ON generations(experiment_id, generation_number);
CREATE INDEX IF NOT EXISTS idx_generations_created_at ON generations(created_at);

-- Agents
CREATE INDEX IF NOT EXISTS idx_agents_experiment_id ON agents(experiment_id);
CREATE INDEX IF NOT EXISTS idx_agents_generation_id ON agents(generation_id);
CREATE INDEX IF NOT EXISTS idx_agents_experiment_generation ON agents(experiment_id, generation_id);

-- Matches
CREATE INDEX IF NOT EXISTS idx_matches_experiment_id ON matches(experiment_id);
CREATE INDEX IF NOT EXISTS idx_matches_generation_id ON matches(generation_id);

-- Workers
CREATE INDEX IF NOT EXISTS idx_workers_status ON workers(status);
CREATE INDEX IF NOT EXISTS idx_workers_last_heartbeat ON workers(last_heartbeat);
CREATE INDEX IF NOT EXISTS idx_workers_last_activity ON workers(last_activity_at);

-- Job Assignments
CREATE INDEX IF NOT EXISTS idx_job_assignments_experiment_id ON job_assignments(experiment_id);
CREATE INDEX IF NOT EXISTS idx_job_assignments_worker_id ON job_assignments(worker_id);
CREATE INDEX IF NOT EXISTS idx_job_assignments_status ON job_assignments(status);
CREATE INDEX IF NOT EXISTS idx_job_assignments_experiment_generation ON job_assignments(experiment_id, generation_start, generation_end);
CREATE INDEX IF NOT EXISTS idx_job_assignments_job_id ON job_assignments(job_id);
CREATE INDEX IF NOT EXISTS idx_job_assignments_claimed_at ON job_assignments(claimed_at) WHERE claimed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_job_assignments_worker_active ON job_assignments(worker_id, status) WHERE status IN ('assigned', 'processing');

-- Checkpoints
CREATE INDEX IF NOT EXISTS idx_checkpoints_experiment_id ON experiment_checkpoints(experiment_id);
CREATE INDEX IF NOT EXISTS idx_checkpoints_generation ON experiment_checkpoints(experiment_id, generation_number DESC);

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at on workers table
DROP TRIGGER IF EXISTS update_workers_updated_at ON workers;
CREATE TRIGGER update_workers_updated_at BEFORE UPDATE ON workers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ATOMIC JOB MANAGEMENT FUNCTIONS
-- ============================================================================

-- Atomic claim function: Claims a job and increments worker's active_jobs_count
CREATE OR REPLACE FUNCTION claim_job_atomic(
    p_job_id TEXT,
    p_worker_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_claimed BOOLEAN := FALSE;
BEGIN
    UPDATE job_assignments
    SET status = 'processing', 
        started_at = NOW(),
        claimed_at = NOW()
    WHERE job_id = p_job_id 
      AND worker_id = p_worker_id 
      AND status = 'assigned';
    
    IF FOUND THEN
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

-- Atomic complete function: Marks job complete and decrements worker's count
CREATE OR REPLACE FUNCTION complete_job_atomic(
    p_job_id TEXT,
    p_worker_id UUID,
    p_status TEXT DEFAULT 'completed'
) RETURNS BOOLEAN AS $$
DECLARE
    v_completed BOOLEAN := FALSE;
BEGIN
    IF p_status NOT IN ('completed', 'failed') THEN
        RAISE EXCEPTION 'Invalid status: %. Must be completed or failed', p_status;
    END IF;
    
    UPDATE job_assignments
    SET status = p_status::job_assignment_status_type, 
        completed_at = NOW()
    WHERE job_id = p_job_id 
      AND worker_id = p_worker_id
      AND status = 'processing';
    
    IF FOUND THEN
        UPDATE workers 
        SET active_jobs_count = GREATEST(0, active_jobs_count - 1),
            last_heartbeat = NOW()
        WHERE id = p_worker_id;
        
        UPDATE workers
        SET status = 'idle'
        WHERE id = p_worker_id
          AND active_jobs_count = 0;
        
        v_completed := TRUE;
    END IF;
    
    RETURN v_completed;
END;
$$ LANGUAGE plpgsql;

-- Atomic release function: Releases job back to queue for reassignment
CREATE OR REPLACE FUNCTION release_job_atomic(
    p_job_id TEXT,
    p_worker_id UUID,
    p_reason TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_released BOOLEAN := FALSE;
BEGIN
    UPDATE job_assignments
    SET status = 'failed', 
        completed_at = NOW(),
        release_reason = COALESCE(p_reason, 'Released by worker')
    WHERE job_id = p_job_id 
      AND worker_id = p_worker_id
      AND status IN ('assigned', 'processing');
    
    IF FOUND THEN
        UPDATE workers 
        SET active_jobs_count = GREATEST(0, active_jobs_count - 1),
            last_heartbeat = NOW()
        WHERE id = p_worker_id;
        
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
-- SEQUENTIAL BATCH ENFORCEMENT
-- ============================================================================

-- Function to check for overlapping generation ranges
CREATE OR REPLACE FUNCTION check_no_overlapping_batches()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM job_assignments
        WHERE experiment_id = NEW.experiment_id
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND status IN ('assigned', 'processing')
        AND NOT (NEW.generation_end < generation_start OR NEW.generation_start > generation_end)
    ) THEN
        RAISE EXCEPTION 'Cannot assign overlapping generation range. Another batch is already active for this experiment.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce no overlapping batches
DROP TRIGGER IF EXISTS trigger_check_no_overlapping_batches ON job_assignments;
CREATE TRIGGER trigger_check_no_overlapping_batches
    BEFORE INSERT OR UPDATE ON job_assignments
    FOR EACH ROW
    WHEN (NEW.status IN ('assigned', 'processing'))
    EXECUTE FUNCTION check_no_overlapping_batches();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE experiments IS 'Scientific experiments comparing control vs experimental mutation strategies';
COMMENT ON TABLE generations IS 'Time-series data for each generation of an experiment';
COMMENT ON TABLE agents IS 'Individual neural network agents in each generation';
COMMENT ON TABLE matches IS 'Match results between agents';
COMMENT ON TABLE workers IS 'Distributed GPU workers for processing experiments';
COMMENT ON TABLE job_assignments IS 'Job sharding for distributed processing';
COMMENT ON TABLE experiment_checkpoints IS 'Population state checkpoints for experiment recovery';
COMMENT ON FUNCTION check_no_overlapping_batches() IS 'Prevents assigning overlapping generation ranges for sequential processing';
