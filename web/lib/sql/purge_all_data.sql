-- Purge all data, keep tables and structure
-- Run this with psql: psql -U evonash -d evonash -f purge_all_data.sql
-- WARNING: This permanently deletes all rows in all application tables.

-- Truncate root tables; CASCADE clears all tables that reference them:
--   experiments -> generations, agents, matches, job_assignments, experiment_checkpoints
--   workers     -> job_assignments (also references experiments)
TRUNCATE TABLE experiments, workers CASCADE;
