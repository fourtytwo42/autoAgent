export type EventType =
  | 'goal_created'
  | 'task_created'
  | 'task_updated'
  | 'agent_run'
  | 'judgement_written'
  | 'agent_proposal_created'
  | 'architecture_vote'
  | 'model_updated'
  | 'agent_updated'
  | 'error';

export interface Event {
  id: string;
  type: EventType;
  agent_id?: string | null;
  model_id?: string | null;
  blackboard_item_id?: string | null;
  job_id?: string | null;
  data: Record<string, any>;
  created_at: Date;
}

// Database row types (matches schema)
export interface EventRow {
  id: string;
  type: string;
  agent_id: string | null;
  model_id: string | null;
  blackboard_item_id: string | null;
  job_id: string | null;
  data: Record<string, any>;
  created_at: Date;
}

