-- Sequential Batch Processing Migration
-- Prevents multiple batches from being assigned simultaneously for the same experiment
-- Since generations depend on previous generations, only one batch can be active at a time

-- Add a function to check for overlapping generation ranges
-- This will be used in a trigger to prevent duplicate assignments
CREATE OR REPLACE FUNCTION check_no_overlapping_batches()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if there's an overlapping batch with status 'assigned' or 'processing'
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

-- Add comment explaining the constraint
COMMENT ON FUNCTION check_no_overlapping_batches() IS 'Prevents assigning overlapping generation ranges for the same experiment when status is assigned or processing. This ensures sequential processing since each generation depends on the previous one.';
