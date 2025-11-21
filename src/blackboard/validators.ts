import { BlackboardItem, BlackboardItemType } from '@/src/types/blackboard';

const VALID_TYPES: BlackboardItemType[] = [
  'user_request',
  'goal',
  'task',
  'agent_output',
  'judgement',
  'agent_proposal',
  'architecture_vote',
  'memory_entry',
  'metric',
];

export function validateBlackboardItem(item: Partial<BlackboardItem>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!item.type) {
    errors.push('Type is required');
  } else if (!VALID_TYPES.includes(item.type as BlackboardItemType)) {
    errors.push(`Invalid type: ${item.type}`);
  }

  if (!item.summary || typeof item.summary !== 'string' || item.summary.trim().length === 0) {
    errors.push('Summary is required and must be non-empty');
  }

  if (item.dimensions && typeof item.dimensions !== 'object') {
    errors.push('Dimensions must be an object');
  }

  if (item.links) {
    if (typeof item.links !== 'object') {
      errors.push('Links must be an object');
    } else {
      const { parents, children, related } = item.links as any;
      if (parents && !Array.isArray(parents)) {
        errors.push('Links.parents must be an array');
      }
      if (children && !Array.isArray(children)) {
        errors.push('Links.children must be an array');
      }
      if (related && !Array.isArray(related)) {
        errors.push('Links.related must be an array');
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateLinkRelation(relation: string): relation is 'parent' | 'child' | 'related' {
  return relation === 'parent' || relation === 'child' || relation === 'related';
}

