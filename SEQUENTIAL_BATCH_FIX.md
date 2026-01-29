# Sequential Batch Processing Fix

## Problem
The system was assigning multiple batches for the same generation range (e.g., multiple workers all getting batches 0-9) because:
1. Multiple workers polled simultaneously
2. They all saw no existing batches (race condition)
3. They all got assigned the same batch
4. Since each generation depends on the previous one, this caused duplicate work and potential data corruption

## Solution

### 1. Database-Level Constraint
Created `migration_sequential_batches.sql` which adds:
- A trigger function `check_no_overlapping_batches()` that prevents overlapping generation ranges
- The trigger fires BEFORE INSERT/UPDATE and checks if there's an overlapping batch with status 'assigned' or 'processing'
- Raises an exception if overlap is detected

### 2. Queue Route Logic Update
Modified `web/app/api/queue/route.ts` to:
- Check for active batches from OTHER workers before assigning a new batch
- Only allow ONE active batch per experiment at a time
- Allow workers to recover their own jobs (excluded from the active batch check)
- Handle database constraint errors gracefully

## Key Changes

### Database Migration
```sql
-- Prevents overlapping batches via trigger
CREATE TRIGGER trigger_check_no_overlapping_batches
    BEFORE INSERT OR UPDATE ON job_assignments
    FOR EACH ROW
    WHEN (NEW.status IN ('assigned', 'processing'))
    EXECUTE FUNCTION check_no_overlapping_batches();
```

### Queue Route
- Added check: `otherWorkersActiveBatches` - only blocks if OTHER workers have active batches
- Allows workers to recover their own jobs
- Database trigger provides final safety net

## How It Works

1. **Worker polls for job**: Queue route checks for active batches
2. **If another worker has active batch**: Skip assignment (prevents duplicates)
3. **If no active batches OR worker recovering own job**: Proceed with assignment
4. **Database trigger**: Final check prevents any overlapping assignments that slip through

## Testing

After applying the migration, you should see:
- Only ONE batch assigned per experiment at a time
- Workers getting different batches sequentially (0-9, then 10-19, etc.)
- No duplicate generation processing
- Workers can recover their own jobs if they restart

## Migration Instructions

Run the migration:
```sql
-- Apply migration_sequential_batches.sql to your PostgreSQL database
```

The migration is idempotent (safe to run multiple times).
