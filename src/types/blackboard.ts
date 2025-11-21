export interface BlackboardItem {
  id: string;
  type: string;
  summary: string;
  dimensions: Record<string, any>;
  links: {
    parents?: string[];
    children?: string[];
    related?: string[];
  };
  detail?: Record<string, any>;
  created_at?: Date;
  updated_at?: Date;
}

export type BlackboardItemType =
  | 'user_request'
  | 'goal'
  | 'task'
  | 'agent_output'
  | 'judgement'
  | 'agent_proposal'
  | 'architecture_vote'
  | 'memory_entry'
  | 'metric'
  | 'user_query_request'
  | 'user_response';

export interface BlackboardQuery {
  type?: BlackboardItemType | BlackboardItemType[];
  dimensions?: Record<string, any>;
  summary?: string; // Full-text search
  parent_id?: string;
  child_id?: string;
  related_id?: string;
  created_after?: Date;
  created_before?: Date;
  limit?: number;
  offset?: number;
  order_by?: 'created_at' | 'updated_at';
  order_direction?: 'asc' | 'desc';
}

export interface BlackboardLink {
  from_id: string;
  to_id: string;
  relation: 'parent' | 'child' | 'related';
}

// Database row types (matches schema)
export interface BlackboardItemRow {
  id: string;
  type: string;
  summary: string;
  dimensions: Record<string, any>;
  links: Record<string, any>;
  detail: Record<string, any> | null;
  created_at: Date;
  updated_at: Date;
}

