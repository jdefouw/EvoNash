-- Export All Experiment Data
-- Comprehensive SQL queries to extract all data from all experiments

-- ============================================================================
-- OPTION 1: Complete Data Export (All tables joined)
-- ============================================================================
-- This query joins all related data for comprehensive export
SELECT 
    -- Experiment info
    e.id AS experiment_id,
    e.experiment_name,
    e.experiment_group,
    e.mutation_mode,
    e.mutation_rate,
    e.mutation_base,
    e.random_seed,
    e.population_size,
    e.max_generations,
    e.status AS experiment_status,
    e.max_possible_elo,
    e.selection_pressure,
    e.ticks_per_generation,
    e.network_architecture,
    e.created_at AS experiment_created_at,
    e.completed_at AS experiment_completed_at,
    
    -- Generation info
    g.id AS generation_id,
    g.generation_number,
    g.created_at AS generation_created_at,
    g.population_size AS generation_population_size,
    g.avg_fitness,
    g.avg_elo,
    g.peak_elo,
    g.min_elo,
    g.std_elo,
    g.policy_entropy,
    g.entropy_variance,
    g.win_rate_variance,
    g.population_diversity,
    g.mutation_rate AS generation_mutation_rate,
    g.min_fitness,
    g.max_fitness,
    g.std_fitness,
    
    -- Agent info
    a.id AS agent_id,
    a.agent_index,
    a.elo_rating,
    a.fitness_score,
    a.network_weights_path,
    a.parent_elo,
    a.mutation_rate_applied,
    a.created_at AS agent_created_at,
    
    -- Match info
    m.id AS match_id,
    m.agent_a_id,
    m.agent_b_id,
    m.winner_id,
    m.match_type,
    m.move_history,
    m.telemetry,
    m.created_at AS match_created_at
    
FROM experiments e
LEFT JOIN generations g ON e.id = g.experiment_id
LEFT JOIN agents a ON g.id = a.generation_id
LEFT JOIN matches m ON g.id = m.generation_id
ORDER BY e.created_at, g.generation_number, a.agent_index, m.created_at;

-- ============================================================================
-- OPTION 2: Experiments with Generation Summary (Aggregated)
-- ============================================================================
-- This query provides experiment-level summary with generation counts and stats
SELECT 
    e.*,
    COUNT(DISTINCT g.id) AS total_generations,
    MAX(g.generation_number) AS max_generation_completed,
    MIN(g.generation_number) AS min_generation_number,
    AVG(g.avg_elo) AS avg_elo_across_generations,
    MAX(g.peak_elo) AS overall_peak_elo,
    COUNT(DISTINCT a.id) AS total_agents,
    COUNT(DISTINCT m.id) AS total_matches,
    SUM(CASE WHEN m.match_type = 'self_play' THEN 1 ELSE 0 END) AS self_play_matches,
    SUM(CASE WHEN m.match_type = 'benchmark' THEN 1 ELSE 0 END) AS benchmark_matches
FROM experiments e
LEFT JOIN generations g ON e.id = g.experiment_id
LEFT JOIN agents a ON g.id = a.generation_id
LEFT JOIN matches m ON g.id = m.generation_id
GROUP BY e.id
ORDER BY e.created_at DESC;

-- ============================================================================
-- OPTION 3: Experiments Table Only
-- ============================================================================
SELECT * FROM experiments ORDER BY created_at DESC;

-- ============================================================================
-- OPTION 4: Generations with Experiment Info
-- ============================================================================
SELECT 
    e.experiment_name,
    e.experiment_group,
    e.mutation_mode,
    g.*
FROM generations g
JOIN experiments e ON g.experiment_id = e.id
ORDER BY e.created_at, g.generation_number;

-- ============================================================================
-- OPTION 5: Agents with Full Context
-- ============================================================================
SELECT 
    e.experiment_name,
    e.experiment_group,
    g.generation_number,
    a.*
FROM agents a
JOIN generations g ON a.generation_id = g.id
JOIN experiments e ON g.experiment_id = e.id
ORDER BY e.created_at, g.generation_number, a.agent_index;

-- ============================================================================
-- OPTION 6: Matches with Full Context
-- ============================================================================
SELECT 
    e.experiment_name,
    e.experiment_group,
    g.generation_number,
    m.*,
    a_a.elo_rating AS agent_a_elo,
    a_b.elo_rating AS agent_b_elo
FROM matches m
JOIN generations g ON m.generation_id = g.id
JOIN experiments e ON g.experiment_id = e.id
LEFT JOIN agents a_a ON m.agent_a_id = a_a.id
LEFT JOIN agents a_b ON m.agent_b_id = a_b.id
ORDER BY e.created_at, g.generation_number, m.created_at;

-- ============================================================================
-- OPTION 7: Export to CSV format (for PostgreSQL)
-- ============================================================================
-- Run this in psql or pgAdmin to export to CSV:
-- \copy (SELECT * FROM experiments) TO 'experiments.csv' CSV HEADER;
-- \copy (SELECT * FROM generations) TO 'generations.csv' CSV HEADER;
-- \copy (SELECT * FROM agents) TO 'agents.csv' CSV HEADER;
-- \copy (SELECT * FROM matches) TO 'matches.csv' CSV HEADER;

-- ============================================================================
-- OPTION 8: Checkpoints Data
-- ============================================================================
SELECT 
    e.experiment_name,
    e.experiment_group,
    c.*
FROM experiment_checkpoints c
JOIN experiments e ON c.experiment_id = e.id
ORDER BY e.created_at, c.generation_number;

-- ============================================================================
-- OPTION 9: Job Assignments with Experiment Info
-- ============================================================================
SELECT 
    e.experiment_name,
    e.experiment_group,
    w.worker_name,
    w.gpu_type,
    ja.*
FROM job_assignments ja
JOIN experiments e ON ja.experiment_id = e.id
LEFT JOIN workers w ON ja.worker_id = w.id
ORDER BY e.created_at, ja.assigned_at;
