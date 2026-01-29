-- Migration: Add ticks_per_generation column to experiments table
-- Run this with psql: psql -U evonash -d evonash -f migration_add_ticks_per_generation.sql

-- Add ticks_per_generation column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'experiments' 
        AND column_name = 'ticks_per_generation'
    ) THEN
        ALTER TABLE experiments 
        ADD COLUMN ticks_per_generation INTEGER DEFAULT 750;
        
        -- Update existing rows to have the default value
        UPDATE experiments 
        SET ticks_per_generation = 750 
        WHERE ticks_per_generation IS NULL;
    END IF;
END $$;
