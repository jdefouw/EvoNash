// TypeScript types matching the shared protocol.json schema

export type MatchType = 'self_play' | 'benchmark';

export type MutationMode = 'STATIC' | 'ADAPTIVE';
export type ExperimentGroup = 'CONTROL' | 'EXPERIMENTAL';
export type ExperimentStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'STOPPED';

/**
 * Derives mutation_mode from experiment_group.
 * This enforces the proper experimental design:
 * - CONTROL group uses STATIC mutation (fixed rate ε = 0.05)
 * - EXPERIMENTAL group uses ADAPTIVE mutation (fitness-scaled ε = f(Elo))
 */
export function getMutationModeFromGroup(group: ExperimentGroup): MutationMode {
  return group === 'CONTROL' ? 'STATIC' : 'ADAPTIVE';
}

export interface NetworkArchitecture {
  input_size: number;
  hidden_layers: number[];
  output_size: number;
}

export interface ExperimentConfig {
  experiment_id: string;
  experiment_name: string;
  mutation_mode: MutationMode;
  mutation_rate?: number;
  mutation_base?: number;
  max_possible_elo: number;
  random_seed: number;
  population_size: number;
  selection_pressure: number;
  max_generations: number;
  /**
   * Number of simulation ticks per generation.
   * A tick is one discrete simulation step (dt=0.016s) where agent physics,
   * neural network decisions, collisions, and food respawning are processed.
   * Default: 750 ticks ≈ 12 seconds of simulated agent lifetime.
   */
  ticks_per_generation?: number;
  network_architecture: NetworkArchitecture;
  experiment_group: ExperimentGroup;
}

export interface Match {
  id?: string;
  agent_a_id: string;
  agent_b_id: string;
  winner_id: string | null;
  move_history: unknown[];
  telemetry: Record<string, unknown>;
  created_at?: string;
}

export interface GenerationStats {
  avg_fitness: number;
  avg_elo: number;
  peak_elo: number;
  policy_entropy: number;
  entropy_variance: number;
  population_diversity: number;
  mutation_rate: number;
  min_elo?: number;
  std_elo?: number;
  min_fitness?: number;
  max_fitness?: number;
  std_fitness?: number;
}

export interface JobRequest {
  job_id: string;
  experiment_id: string;
  generation_id: string;
  agent_ids: string[];
  match_type: MatchType;
  num_batches: number;
  batch_size: number;
  experiment_config: ExperimentConfig;
}

export interface JobResult {
  job_id: string;
  experiment_id: string;
  generation_id?: string;
  matches: Match[];
  generation_stats: GenerationStats;
}

export interface Experiment {
  id: string;
  experiment_name: string;
  experiment_group: ExperimentGroup;
  mutation_mode: MutationMode;
  random_seed: number;
  population_size: number;
  max_generations: number;
  /**
   * Number of simulation ticks per generation.
   * A tick is one discrete simulation step (dt=0.016s) where agent physics,
   * neural network decisions, collisions, and food respawning are processed.
   * Default: 750 ticks ≈ 12 seconds of simulated agent lifetime.
   */
  ticks_per_generation?: number;
  status: ExperimentStatus;
  created_at: string;
  completed_at?: string;
  mutation_rate?: number;
  mutation_base?: number;
  max_possible_elo: number;
  selection_pressure: number;
  network_architecture: NetworkArchitecture;
}

export interface Generation {
  id: string;
  experiment_id: string;
  generation_number: number;
  created_at: string;
  population_size: number;
  avg_fitness?: number;
  avg_elo?: number;
  peak_elo?: number;
  min_elo?: number;
  std_elo?: number;
  policy_entropy?: number;
  entropy_variance?: number;
  population_diversity?: number;
  mutation_rate?: number;
  min_fitness?: number;
  max_fitness?: number;
  std_fitness?: number;
}
