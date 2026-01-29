# PostgreSQL Migration Instructions

## Required SQL Updates

Run the following migration SQL files using `psql` to support the worker recovery and persistent worker ID features.

### Migration File: `migration_worker_recovery.sql`

This migration adds indexes to optimize the job recovery queries and ensures the schema supports persistent worker IDs.

**To apply:**

```bash
# Connect to your PostgreSQL database and run the migration
psql -U evonash -d evonash -f migration_worker_recovery.sql
```

Or run directly with the full path:

```bash
psql -U evonash -d evonash -f /opt/evonash/web/lib/sql/migration_worker_recovery.sql
```

### What This Migration Does:

1. **Adds composite index** `idx_job_assignments_experiment_status` - Optimizes queries that filter job assignments by experiment_id and status (used in recovery logic)

2. **Adds timestamp index** `idx_job_assignments_timestamps` - Helps with timeout detection queries that check if assignments are stuck (> 5 minutes)

3. **Adds worker-status index** `idx_job_assignments_worker_status` - Optimizes queries that find a worker's own jobs for recovery

4. **Adds documentation** - Comments explaining the recovery mechanism

### Existing Schema Support:

The existing schema already supports:
- Persistent worker IDs (UUID PRIMARY KEY allows manual insertion)
- Job assignment status tracking (assigned, processing, completed, failed)
- Timestamp fields (assigned_at, started_at) for timeout detection
- Worker heartbeat tracking (last_heartbeat) for offline detection

### No Breaking Changes:

This migration only adds indexes and comments. It does not modify any existing tables or data.

### Verification:

After running the migration, verify the indexes were created:

```bash
psql -U evonash -d evonash -c "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'job_assignments' AND indexname LIKE 'idx_job_assignments%';"
```

You should see the new indexes listed.

## Applying All Migrations

To apply all migrations in order:

```bash
cd /opt/evonash/web/lib/sql

# Apply each migration file
psql -U evonash -d evonash -f migration_multi_worker.sql
psql -U evonash -d evonash -f migration_worker_recovery.sql
psql -U evonash -d evonash -f migration_job_ownership.sql
psql -U evonash -d evonash -f migration_checkpoints.sql
psql -U evonash -d evonash -f migration_sequential_batches.sql
psql -U evonash -d evonash -f migration_atomic_job_counts.sql
psql -U evonash -d evonash -f migration_add_ticks_per_generation.sql
```

All migrations are idempotent and safe to run multiple times.
