// TypeScript types matching the shared protocol.json schema

export type MatchType = 'self_play' | 'benchmark' | 'human_vs_ai';

export type MutationMode = 'STATIC' | 'ADAPTIVE';
export type ExperimentGroup = 'CONTROL' | 'EXPERIMENTAL';
export type ExperimentStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

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
  network_architecture: NetworkArchitecture;
  experiment_group: ExperimentGroup;
}

export interface Match {
  agent_a_id: string;
  agent_b_id: string;
  winner_id: string | null;
  move_history: unknown[];
  telemetry: Record<string, unknown>;
}

export interface GenerationStats {
  avg_fitness: number;
  avg_elo: number;
  peak_elo: number;
  policy_entropy: number;
  entropy_variance: number;
  population_diversity: number;
  mutation_rate: number;
}

export interface JobRequest {
  job_id: string;
  experiment_id: string;
  generation_id: string;
  agent_ids: string[];
  match_type: 'self_play' | 'benchmark';
  num_batches: number;
  batch_size: number;
  experiment_config: ExperimentConfig;
}

export interface JobResult {
  job_id: string;
  experiment_id: string;
  matches: Match[];
  generation_stats: GenerationStats;
}
