export type JobType = 'run_agent' | 'maintenance_tick' | 'benchmark_model' | 'update_metrics';
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface Job {
  id: string;
  type: JobType;
  payload: Record<string, any>;
  status: JobStatus;
  attempts: number;
  max_attempts: number;
  scheduled_for: Date;
  locked_at?: Date | null;
  locked_by?: string | null;
  created_at?: Date;
  updated_at?: Date;
}

export interface JobPayload {
  agent_id?: string;
  model_id?: string;
  blackboard_item_id?: string;
  goal_id?: string;
  task_id?: string;
  [key: string]: any;
}

export interface RunAgentJobPayload extends JobPayload {
  agent_id: string;
  context: Record<string, any>;
  options?: {
    temperature?: number;
    maxTokens?: number;
  };
}

// Database row types (matches schema)
export interface JobRow {
  id: string;
  type: string;
  payload: Record<string, any>;
  status: JobStatus;
  attempts: number;
  max_attempts: number;
  scheduled_for: Date;
  locked_at: Date | null;
  locked_by: string | null;
  created_at: Date;
  updated_at: Date;
}

