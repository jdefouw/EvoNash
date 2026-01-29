# Supabase Migration Instructions

## Required SQL Updates

Run the following migration SQL in your Supabase SQL Editor to support the new worker recovery and persistent worker ID features.

### Migration File: `migration_worker_recovery.sql`

This migration adds indexes to optimize the job recovery queries and ensures the schema supports persistent worker IDs.

**To apply:**

1. Open your Supabase Dashboard
2. Go to SQL Editor
3. Copy and paste the contents of `migration_worker_recovery.sql`
4. Run the migration

### What This Migration Does:

1. **Adds composite index** `idx_job_assignments_experiment_status` - Optimizes queries that filter job assignments by experiment_id and status (used in recovery logic)

2. **Adds timestamp index** `idx_job_assignments_timestamps` - Helps with timeout detection queries that check if assignments are stuck (> 5 minutes)

3. **Adds worker-status index** `idx_job_assignments_worker_status` - Optimizes queries that find a worker's own jobs for recovery

4. **Adds documentation** - Comments explaining the recovery mechanism

### Existing Schema Support:

The existing schema already supports:
- ✅ Persistent worker IDs (UUID PRIMARY KEY allows manual insertion)
- ✅ Job assignment status tracking (assigned, processing, completed, failed)
- ✅ Timestamp fields (assigned_at, started_at) for timeout detection
- ✅ Worker heartbeat tracking (last_heartbeat) for offline detection

### No Breaking Changes:

This migration only adds indexes and comments. It does not modify any existing tables or data.

### Verification:

After running the migration, you can verify the indexes were created:

```sql
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'job_assignments' 
AND indexname LIKE 'idx_job_assignments%';
```

You should see the new indexes listed.
