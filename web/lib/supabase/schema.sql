-- EvoNash Database Schema
-- PostgreSQL schema for scientific experiment tracking

-- Create enums
CREATE TYPE experiment_group_type AS ENUM ('CONTROL', 'EXPERIMENTAL');
CREATE TYPE mutation_mode_type AS ENUM ('STATIC', 'ADAPTIVE');
CREATE TYPE experiment_status_type AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');
CREATE TYPE match_type_enum AS ENUM ('self_play', 'benchmark', 'human_vs_ai');

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
    max_possible_elo FLOAT,
    selection_pressure FLOAT,
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
    policy_entropy FLOAT,
    entropy_variance FLOAT,
    win_rate_variance FLOAT,
    population_diversity FLOAT,
    mutation_rate FLOAT,
    peak_elo FLOAT,
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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_generations_experiment_id ON generations(experiment_id);
CREATE INDEX IF NOT EXISTS idx_generations_experiment_generation ON generations(experiment_id, generation_number);
CREATE INDEX IF NOT EXISTS idx_agents_experiment_id ON agents(experiment_id);
CREATE INDEX IF NOT EXISTS idx_agents_generation_id ON agents(generation_id);
CREATE INDEX IF NOT EXISTS idx_agents_experiment_generation ON agents(experiment_id, generation_id);
CREATE INDEX IF NOT EXISTS idx_matches_experiment_id ON matches(experiment_id);
CREATE INDEX IF NOT EXISTS idx_matches_generation_id ON matches(generation_id);
CREATE INDEX IF NOT EXISTS idx_experiments_status ON experiments(status);
CREATE INDEX IF NOT EXISTS idx_experiments_group ON experiments(experiment_group);
