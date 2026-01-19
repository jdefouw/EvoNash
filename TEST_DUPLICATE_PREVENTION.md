# Test Plan: Duplicate Generation Processing Prevention

This document outlines tests to verify that duplicate generation processing is prevented.

## Test Scenarios

### 1. Queue Route - Prevents Assigning Existing Generations

**Test Case 1.1: Queue skips batches where all generations exist**
- **Setup**: Create an experiment with max_generations=50
- **Action**: Insert generations 0-49 into the database
- **Expected**: Queue route should NOT assign any batches (all generations exist)
- **Verification**: 
  - Call `/api/queue` POST endpoint
  - Should return 404 "No unassigned batches available"
  - Check logs for: "allGenerationsExist = true"

**Test Case 1.2: Queue assigns only missing generations**
- **Setup**: Create an experiment with max_generations=50, existing generations 0-29
- **Action**: Request a job from queue
- **Expected**: Queue should assign batch starting at generation 30
- **Verification**:
  - Check job assignment has `generation_start: 30`
  - No job assignments for generations 0-29

**Test Case 1.3: Queue handles partial batch completion**
- **Setup**: Create an experiment with max_generations=50, existing generations 0-34
- **Action**: Request a job from queue
- **Expected**: Queue should assign batch starting at generation 35
- **Verification**:
  - Batch should be 35-44 (or 35-49 if near end)
  - Should not assign 30-34 even though they're in the batch range

### 2. Worker - Skips Existing Generations During Processing

**Test Case 2.1: Worker skips existing generation and loads checkpoint**
- **Setup**: 
  - Create experiment with max_generations=50
  - Insert generation 48 into database
  - Create checkpoint for generation 48
- **Action**: Assign batch 48-49 to worker
- **Expected**: 
  - Worker should detect generation 48 exists
  - Worker should skip processing generation 48
  - Worker should load checkpoint from generation 48
  - Worker should process generation 49 with correct population state
- **Verification**:
  - Check worker logs for: "⏭️ Generation 48 already exists in database, skipping"
  - Check worker logs for: "✓ Loaded checkpoint from generation 48"
  - Verify generation 49 is processed (not skipped)
  - Verify generation 49 has correct population state (evolved from gen 48)

**Test Case 2.2: Worker adjusts batch start when all initial generations exist**
- **Setup**:
  - Create experiment with max_generations=50
  - Insert generations 48-49 into database
  - Create checkpoint for generation 49
- **Action**: Assign batch 48-49 to worker
- **Expected**:
  - Worker should detect both generations exist
  - Worker should adjust `generation_start` to skip both
  - Worker should load checkpoint from generation 49
  - Worker should not process any generations (all exist)
- **Verification**:
  - Check worker logs for: "📝 Adjusting generation_start from 48 to 50"
  - Check worker logs for: "ℹ️ Generation 48 already exists, will skip"
  - Check worker logs for: "ℹ️ Generation 49 already exists, will skip"
  - No simulation should run

**Test Case 2.3: Worker maintains population state continuity**
- **Setup**:
  - Create experiment with max_generations=50
  - Insert generation 47 into database
  - Create checkpoint for generation 47
- **Action**: Assign batch 47-49 to worker
- **Expected**:
  - Worker should skip generation 47
  - Worker should load checkpoint from generation 47
  - Worker should process generation 48 with evolved population from gen 47
  - Worker should process generation 49 with evolved population from gen 48
- **Verification**:
  - Generation 48 should have correct population state (evolved from 47)
  - Generation 49 should have correct population state (evolved from 48)
  - Check that Elo ratings and fitness scores are consistent

### 3. Results Route - Handles Duplicate Uploads Gracefully

**Test Case 3.1: Results route skips duplicate generation inserts**
- **Setup**: Create experiment with generation 48 already in database
- **Action**: Upload generation 48 stats again
- **Expected**: 
  - Results route should detect generation 48 exists
  - Should NOT insert duplicate
  - Should return success with existing generation
- **Verification**:
  - Check logs for: "All 1 generations already exist for experiment X, skipping insert"
  - Verify no duplicate key constraint violation
  - Verify response includes existing generation ID

**Test Case 3.2: Results route handles mixed batch (some new, some existing)**
- **Setup**: Create experiment with generations 47-48 in database
- **Action**: Upload batch with generations 47, 48, 49
- **Expected**:
  - Should skip inserting 47 and 48
  - Should insert only generation 49
  - Should return success
- **Verification**:
  - Check logs for: "Successfully saved 1 new generations (2 already existed)"
  - Verify generation 49 is inserted
  - Verify generations 47-48 are not duplicated

### 4. Integration Test - End-to-End Duplicate Prevention

**Test Case 4.1: Complete workflow with duplicate prevention**
- **Setup**: 
  - Create experiment with max_generations=50
  - Process generations 0-47 (all complete)
  - Generation 48 is partially processed (exists in DB but worker crashed)
- **Action**: 
  - Worker requests new job
  - Queue assigns batch 48-49
  - Worker processes batch
- **Expected**:
  - Queue should assign batch 48-49 (generation 48 exists but 49 doesn't)
  - Worker should skip generation 48
  - Worker should load checkpoint from generation 48
  - Worker should process generation 49
  - Results should upload generation 49 (48 already exists)
- **Verification**:
  - All generations 0-49 should exist in database
  - No duplicate generation 48
  - Generation 49 should have correct population state
  - Experiment should be marked COMPLETED

## Manual Testing Steps

### Quick Verification Test

1. **Create a test experiment**:
   ```sql
   -- Insert test experiment
   INSERT INTO experiments (experiment_name, experiment_group, mutation_mode, random_seed, population_size, max_generations, status)
   VALUES ('Test Duplicate Prevention', 'CONTROL', 'STATIC', 12345, 100, 10, 'RUNNING');
   ```

2. **Manually insert some generations**:
   ```sql
   -- Insert generations 0-4
   INSERT INTO generations (experiment_id, generation_number, population_size, avg_elo, peak_elo, min_elo)
   SELECT id, generate_series(0, 4), 100, 1500.0, 1600.0, 1400.0
   FROM experiments WHERE experiment_name = 'Test Duplicate Prevention';
   ```

3. **Request a job from queue**:
   ```bash
   curl -X POST http://localhost:3000/api/queue \
     -H "Content-Type: application/json" \
     -d '{"worker_id": "test-worker-id"}'
   ```

4. **Verify**:
   - Job should start at generation 5 (not 0)
   - Check worker logs for skipping messages
   - Verify no duplicate generations are created

## Code Verification Checklist

- [x] Queue route checks `existingGenerationNumbers` before assigning batches
- [x] Queue route skips batches where `allGenerationsExist = true`
- [x] Worker checks for existing generations at batch start
- [x] Worker adjusts `generation_start` to skip existing generations
- [x] Worker loads checkpoints when skipping generations
- [x] Worker checks each generation before processing in loop
- [x] Results route checks for existing generations before insert
- [x] Results route filters out duplicates before insert
- [x] Results route returns existing generations when all are duplicates

## Expected Log Messages

When duplicate prevention is working, you should see:

**Queue Route:**
- `[QUEUE] Checking existing generations...`
- `[QUEUE] Skipping batch X-Y (all generations exist)`

**Worker:**
- `ℹ️  Generation X already exists, will skip`
- `📝 Adjusting generation_start from X to Y to skip existing generations`
- `⏭️  Generation X already exists in database, skipping to save GPU time`
- `✓ Loaded checkpoint from generation X to maintain population state continuity`

**Results Route:**
- `[RESULTS] All X generations already exist for experiment Y, skipping insert`
- `[RESULTS] Successfully saved X new generations for experiment Y (Y already existed)`

## Performance Impact

- **Before**: Worker would process same generation multiple times (wasteful GPU time)
- **After**: Worker skips existing generations (saves GPU time)
- **Checkpoint Loading**: Adds ~100-500ms per skipped generation (acceptable trade-off)

## Edge Cases to Test

1. **No checkpoint available for skipped generation**: Worker should warn but continue
2. **Network error during generation check**: Worker should assume generation doesn't exist (safer to process than skip)
3. **Race condition**: Two workers assigned same batch - results route handles duplicates gracefully
4. **Partial batch**: Some generations exist, some don't - worker should process only missing ones
