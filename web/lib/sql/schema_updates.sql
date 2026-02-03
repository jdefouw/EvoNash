
-- System Verification Logs
-- Tracks the results of automated verification tests (e.g., CUDA equivalence)
CREATE TABLE IF NOT EXISTS system_verification (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id UUID REFERENCES workers(id) ON DELETE SET NULL,
    test_suite TEXT NOT NULL, -- e.g., 'test_cuda_optimizations.py'
    status TEXT NOT NULL, -- 'PASS', 'FAIL'
    details JSONB, -- specific test results
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Calibration Logs
-- Tracks calibration runs to determine noise floor and thresholds
CREATE TABLE IF NOT EXISTS calibration_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id UUID REFERENCES workers(id) ON DELETE SET NULL,
    metric_name TEXT NOT NULL, -- e.g., 'entropy_variance'
    min_value FLOAT,
    mean_value FLOAT,
    recommended_threshold FLOAT,
    generations_run INTEGER,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_system_verification_worker ON system_verification(worker_id);
CREATE INDEX IF NOT EXISTS idx_system_verification_executed_at ON system_verification(executed_at);
CREATE INDEX IF NOT EXISTS idx_calibration_logs_worker ON calibration_logs(worker_id);
