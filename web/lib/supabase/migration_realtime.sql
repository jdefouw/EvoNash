-- Migration: Enable Supabase Realtime for workers, generations, and experiments tables
-- Run this in Supabase SQL Editor
-- This enables instant updates in the UI when data changes

-- Enable Realtime for workers table (worker registration, status changes, heartbeats)
ALTER PUBLICATION supabase_realtime ADD TABLE workers;

-- Enable Realtime for generations table (live generation progress updates)
ALTER PUBLICATION supabase_realtime ADD TABLE generations;

-- Enable Realtime for experiments table (status changes including auto-completion)
ALTER PUBLICATION supabase_realtime ADD TABLE experiments;

-- Set REPLICA IDENTITY FULL for proper change tracking
-- This ensures UPDATE events include both old and new row data
ALTER TABLE workers REPLICA IDENTITY FULL;
ALTER TABLE generations REPLICA IDENTITY FULL;
ALTER TABLE experiments REPLICA IDENTITY FULL;

-- Note: After running this migration, the UI will receive instant updates for:
-- 1. Worker registrations, status changes, and disconnections
-- 2. New generations being processed
-- 3. Experiment status changes (PENDING -> RUNNING -> COMPLETED)
