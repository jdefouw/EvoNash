-- Multi-Worker Distributed Job Sharding Migration
-- Adds workers and job_assignments tables for distributed processing

-- Create worker status enum
DO $$ BEGIN
    CREATE TYPE worker_status_type AS ENUM ('idle', 'processing', 'offline');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create job assignment status enum
DO $$ BEGIN
    CREATE TYPE job_assignment_status_type AS ENUM ('assigned', 'processing', 'completed', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

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
    job_id TEXT NOT NULL UNIQUE,
    CONSTRAINT valid_generation_range CHECK (generation_end >= generation_start)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_workers_status ON workers(status);
CREATE INDEX IF NOT EXISTS idx_workers_last_heartbeat ON workers(last_heartbeat);
CREATE INDEX IF NOT EXISTS idx_job_assignments_experiment_id ON job_assignments(experiment_id);
CREATE INDEX IF NOT EXISTS idx_job_assignments_worker_id ON job_assignments(worker_id);
CREATE INDEX IF NOT EXISTS idx_job_assignments_status ON job_assignments(status);
CREATE INDEX IF NOT EXISTS idx_job_assignments_experiment_generation ON job_assignments(experiment_id, generation_start, generation_end);
CREATE INDEX IF NOT EXISTS idx_job_assignments_job_id ON job_assignments(job_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at on workers table
CREATE TRIGGER update_workers_updated_at BEFORE UPDATE ON workers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
