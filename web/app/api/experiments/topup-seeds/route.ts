import { NextRequest, NextResponse } from 'next/server'
import { queryAll, queryOne, insertMany } from '@/lib/postgres'
import { requireAuth } from '@/lib/auth'
import { CONVERGED_RUNS_CTES } from '@/lib/convergence-sql'

export const dynamic = 'force-dynamic'

// Configurable safety caps
const TARGET_CONVERGED_DEFAULT = 10  // Each (seed, group) wants this many converged
const BUFFER_EXTRA_DEFAULT = 3       // Spawn this many extras (some attempts won't converge)
const MAX_IN_FLIGHT_PER_SIDE = 15    // Never queue more than this PENDING+RUNNING per (seed, group)
const MAX_SPAWN_PER_CALL = 500       // Hard cap so a single call can't spam the GPU farm

interface TopupPlanRow {
  seed: number
  group: 'CONTROL' | 'EXPERIMENTAL'
  converged: number
  inFlight: number     // PENDING + RUNNING
  shortfall: number    // target + buffer - converged - inFlight
  spawn: number        // actually-spawned count after caps
}

/**
 * POST /api/experiments/topup-seeds
 *
 * For each seed in the experiments table, compute how many converged
 * experiments exist per group. If a side is below (target + buffer) AND
 * there isn't already a corresponding number of PENDING/RUNNING experiments
 * working on it, spawn new PENDING experiments using an existing experiment
 * for that seed as a config template (or a default config if none exists).
 *
 * Auth: requires Bearer API_SECRET_KEY.
 *
 * Body (all optional):
 *   {
 *     targetConverged?: number,   // default 10
 *     bufferExtra?: number,        // default 3
 *     dryRun?: boolean             // if true, returns plan without spawning
 *   }
 *
 * Returns:
 *   {
 *     success: boolean,
 *     dryRun: boolean,
 *     targetConverged: number,
 *     bufferExtra: number,
 *     totalSpawned: number,
 *     totalShortfallSeeds: number,
 *     plan: TopupPlanRow[]
 *   }
 */
export async function POST(request: NextRequest) {
  const authError = requireAuth(request)
  if (authError) return authError

  try {
    const body = await request.json().catch(() => ({}))
    const target = clampInt(body.targetConverged, TARGET_CONVERGED_DEFAULT, 1, 100)
    const buffer = clampInt(body.bufferExtra, BUFFER_EXTRA_DEFAULT, 0, 20)
    const dryRun = body.dryRun === true

    console.log(`[TOPUP-SEEDS] Start: target=${target}, buffer=${buffer}, dryRun=${dryRun}`)

    // ── Step 1: count converged experiments per (seed, group) ────────────
    const convergedRows = await queryAll<{ seed: number; group: string; count: number }>(`
      WITH ${CONVERGED_RUNS_CTES}
      SELECT
        random_seed::int as seed,
        experiment_group as group,
        COUNT(*)::int as count
      FROM converged_runs
      GROUP BY random_seed, experiment_group
    `)

    // ── Step 2: count PENDING + RUNNING experiments per (seed, group) ────
    const inflightRows = await queryAll<{ seed: number; group: string; count: number }>(`
      SELECT
        random_seed::int as seed,
        experiment_group as group,
        COUNT(*)::int as count
      FROM experiments
      WHERE status IN ('PENDING', 'RUNNING')
        AND random_seed IS NOT NULL
        AND experiment_group IN ('CONTROL', 'EXPERIMENTAL')
      GROUP BY random_seed, experiment_group
    `)

    // ── Step 3: enumerate all known seeds (to also catch 0/N unpaired) ───
    const allSeedRows = await queryAll<{ seed: number }>(`
      SELECT DISTINCT random_seed::int as seed
      FROM experiments
      WHERE random_seed IS NOT NULL
    `)
    const allSeeds = allSeedRows.map(r => Number(r.seed))

    const convergedMap = new Map<string, number>()
    for (const r of convergedRows) convergedMap.set(`${r.seed}_${r.group}`, Number(r.count))
    const inflightMap = new Map<string, number>()
    for (const r of inflightRows) inflightMap.set(`${r.seed}_${r.group}`, Number(r.count))

    // ── Step 4: build the shortfall plan ────────────────────────────────
    const groups: Array<'CONTROL' | 'EXPERIMENTAL'> = ['CONTROL', 'EXPERIMENTAL']
    const desired = target + buffer
    let plan: TopupPlanRow[] = []

    for (const seed of allSeeds) {
      for (const group of groups) {
        const converged = convergedMap.get(`${seed}_${group}`) ?? 0
        const inFlight = inflightMap.get(`${seed}_${group}`) ?? 0
        // Shortfall = how many more "attempts" we need given convergence buffer
        const shortfall = Math.max(0, desired - converged - inFlight)
        // But never let in-flight per side exceed the cap (avoid runaway spawning)
        const inFlightHeadroom = Math.max(0, MAX_IN_FLIGHT_PER_SIDE - inFlight)
        const spawn = Math.min(shortfall, inFlightHeadroom)
        if (spawn > 0) {
          plan.push({ seed, group, converged, inFlight, shortfall, spawn })
        }
      }
    }

    // ── Step 5: enforce per-call total cap (prioritize neediest first) ───
    plan.sort((a, b) => {
      // Most-needy first: lowest converged count, then highest shortfall
      if (a.converged !== b.converged) return a.converged - b.converged
      return b.shortfall - a.shortfall
    })

    let totalSpawn = plan.reduce((s, p) => s + p.spawn, 0)
    if (totalSpawn > MAX_SPAWN_PER_CALL) {
      let remaining = MAX_SPAWN_PER_CALL
      for (const p of plan) {
        if (remaining <= 0) {
          p.spawn = 0
        } else if (p.spawn > remaining) {
          p.spawn = remaining
          remaining = 0
        } else {
          remaining -= p.spawn
        }
      }
      plan = plan.filter(p => p.spawn > 0)
      totalSpawn = plan.reduce((s, p) => s + p.spawn, 0)
    }

    console.log(`[TOPUP-SEEDS] Plan: ${plan.length} (seed,group) shortfalls, total spawn = ${totalSpawn}`)

    if (dryRun || totalSpawn === 0) {
      return NextResponse.json({
        success: true,
        dryRun,
        targetConverged: target,
        bufferExtra: buffer,
        totalSpawned: 0,
        totalShortfallSeeds: plan.length,
        plan,
      })
    }

    // ── Step 6: for each shortfall, find a config template and spawn ─────
    let totalSpawned = 0
    const errors: string[] = []
    for (const p of plan) {
      try {
        const created = await spawnForShortfall(p)
        totalSpawned += created
      } catch (err: any) {
        const msg = `seed=${p.seed} group=${p.group}: ${err?.message || String(err)}`
        console.error(`[TOPUP-SEEDS] Failed to spawn for ${msg}`)
        errors.push(msg)
      }
    }

    console.log(`[TOPUP-SEEDS] Done: spawned ${totalSpawned} PENDING experiments, ${errors.length} errors`)

    return NextResponse.json({
      success: true,
      dryRun: false,
      targetConverged: target,
      bufferExtra: buffer,
      totalSpawned,
      totalShortfallSeeds: plan.length,
      plan,
      errors,
    })
  } catch (error: any) {
    console.error('[TOPUP-SEEDS] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Failed to top up seeds', details: error?.message || String(error) },
      { status: 500 }
    )
  }
}

function clampInt(v: any, dflt: number, min: number, max: number): number {
  const n = parseInt(v)
  if (isNaN(n)) return dflt
  return Math.max(min, Math.min(max, n))
}

/**
 * Spawn N PENDING experiments for a (seed, group) shortfall, copying
 * configuration from an existing experiment for that seed (or, failing
 * that, any existing experiment) so all simulation parameters match.
 */
async function spawnForShortfall(p: TopupPlanRow): Promise<number> {
  // Prefer template from same seed + same group (perfect match)
  let template: any = await queryOne(
    `SELECT experiment_name, mutation_rate, mutation_base, max_possible_fitness,
            population_size, selection_pressure, max_generations, ticks_per_generation,
            network_architecture
     FROM experiments
     WHERE random_seed = $1 AND experiment_group = $2
     LIMIT 1`,
    [p.seed, p.group]
  )

  // Fallback 1: same seed, opposite group
  if (!template) {
    template = await queryOne(
      `SELECT experiment_name, mutation_rate, mutation_base, max_possible_fitness,
              population_size, selection_pressure, max_generations, ticks_per_generation,
              network_architecture
       FROM experiments
       WHERE random_seed = $1
       LIMIT 1`,
      [p.seed]
    )
  }

  // Fallback 2: any experiment in the system
  if (!template) {
    template = await queryOne(
      `SELECT experiment_name, mutation_rate, mutation_base, max_possible_fitness,
              population_size, selection_pressure, max_generations, ticks_per_generation,
              network_architecture
       FROM experiments
       LIMIT 1`
    )
  }

  // Final fallback: hardcoded defaults
  if (!template) {
    template = {
      experiment_name: `Topup Seed ${p.seed}`,
      mutation_rate: null,
      mutation_base: null,
      max_possible_fitness: 2000.0,
      population_size: 1000,
      selection_pressure: 0.2,
      max_generations: 1500,
      ticks_per_generation: 750,
      network_architecture: JSON.stringify({ input_size: 24, hidden_layers: [64], output_size: 4 }),
    }
  }

  const mutationMode = p.group === 'CONTROL' ? 'STATIC' : 'ADAPTIVE'
  // Strip any trailing "Control N" / "Experimental N" / "Topup ..." from the base name
  const baseName = String(template.experiment_name)
    .replace(/\s*Topup\s+(Control|Experimental)\s+\d+\s*$/i, '')
    .replace(/\s+(Control|Experimental)\s+\d+\s*$/i, '')
    .trim()

  const archStr =
    typeof template.network_architecture === 'string'
      ? template.network_architecture
      : JSON.stringify(template.network_architecture)

  const rows: Record<string, any>[] = []
  for (let i = 1; i <= p.spawn; i++) {
    rows.push({
      experiment_name: `${baseName} Topup ${p.group === 'CONTROL' ? 'Control' : 'Experimental'} ${i}`,
      experiment_group: p.group,
      mutation_mode: mutationMode,
      random_seed: p.seed,
      population_size: template.population_size,
      max_generations: template.max_generations,
      ticks_per_generation: template.ticks_per_generation,
      mutation_rate: template.mutation_rate,
      mutation_base: template.mutation_base,
      max_possible_fitness: template.max_possible_fitness,
      selection_pressure: template.selection_pressure,
      network_architecture: archStr,
      status: 'PENDING',
    })
  }

  await insertMany('experiments', rows)
  console.log(`[TOPUP-SEEDS] Spawned ${rows.length} ${p.group} experiments for seed ${p.seed}`)
  return rows.length
}
