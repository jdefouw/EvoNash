-- EvoNash Database Schema
-- PostgreSQL schema for scientific experiment tracking
-- Includes TimescaleDB hypertable for time-series optimization

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
    -- Check if 'STOPPED' value already exists in the enum
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
    ticks_per_generation INTEGER DEFAULT 500,
    network_architecture JSONB
);

-- Generations Table (TimescaleDB hypertable)
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

-- Convert generations to TimescaleDB hypertable (OPTIONAL)
-- Note: TimescaleDB is not available on all Supabase instances
-- If you have TimescaleDB enabled, uncomment the following lines:
-- CREATE EXTENSION IF NOT EXISTS timescaledb;
-- SELECT create_hypertable('generations', 'created_at', if_not_exists => TRUE);
-- The schema works fine without TimescaleDB, just without time-series optimizations

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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_generations_experiment_id ON generations(experiment_id);
CREATE INDEX IF NOT EXISTS idx_generations_experiment_generation ON generations(experiment_id, generation_number);
CREATE INDEX IF NOT EXISTS idx_generations_created_at ON generations(created_at);
CREATE INDEX IF NOT EXISTS idx_agents_experiment_id ON agents(experiment_id);
CREATE INDEX IF NOT EXISTS idx_agents_generation_id ON agents(generation_id);
CREATE INDEX IF NOT EXISTS idx_agents_experiment_generation ON agents(experiment_id, generation_id);
CREATE INDEX IF NOT EXISTS idx_matches_experiment_id ON matches(experiment_id);
CREATE INDEX IF NOT EXISTS idx_matches_generation_id ON matches(generation_id);
CREATE INDEX IF NOT EXISTS idx_experiments_status ON experiments(status);
CREATE INDEX IF NOT EXISTS idx_experiments_group ON experiments(experiment_group);

-- Multi-Worker Distributed Job Sharding Tables

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

-- Create indexes for workers and job_assignments
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
DROP TRIGGER IF EXISTS update_workers_updated_at ON workers;
CREATE TRIGGER update_workers_updated_at BEFORE UPDATE ON workers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
