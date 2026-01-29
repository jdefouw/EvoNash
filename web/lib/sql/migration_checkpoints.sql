-- Experiment Checkpoints Migration
-- Adds checkpoint table for saving and loading population state

-- Create experiment_checkpoints table
CREATE TABLE IF NOT EXISTS experiment_checkpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    generation_number INTEGER NOT NULL,
    population_state JSONB NOT NULL,  -- Serialized agent states
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(experiment_id, generation_number)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_checkpoints_experiment_id ON experiment_checkpoints(experiment_id);
CREATE INDEX IF NOT EXISTS idx_checkpoints_generation ON experiment_checkpoints(experiment_id, generation_number DESC);

-- Add comment
COMMENT ON TABLE experiment_checkpoints IS 'Stores population state checkpoints for experiment recovery';
