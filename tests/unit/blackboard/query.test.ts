import { describe, it, expect } from 'vitest';
import { blackboardQuery, BlackboardQueryBuilder } from '@/src/blackboard/query';

describe('BlackboardQueryBuilder', () => {
  describe('builder methods', () => {
    it('should build query with type filter', () => {
      const query = blackboardQuery().type('goal').build();
      expect(query.type).toBe('goal');
    });

    it('should build query with summary search', () => {
      const query = blackboardQuery().summary('test').build();
      expect(query.summary).toBe('test');
    });

    it('should build query with dimension filters', () => {
      const query = blackboardQuery()
        .dimensions({ status: 'open', priority: 'high' })
        .build();
      expect(query.dimensions).toEqual({ status: 'open', priority: 'high' });
    });

    it('should build query with limit and offset', () => {
      const query = blackboardQuery().limit(10).offset(20).build();
      expect(query.limit).toBe(10);
      expect(query.offset).toBe(20);
    });

    it('should combine multiple filters', () => {
      const query = blackboardQuery()
        .type('task')
        .dimensions({ status: 'pending' })
        .limit(5)
        .build();
      expect(query.type).toBe('task');
      expect(query.dimensions).toEqual({ status: 'pending' });
      expect(query.limit).toBe(5);
    });

    it('should support method chaining', () => {
      const query = blackboardQuery()
        .type('goal')
        .dimensions({ status: 'open' })
        .limit(10)
        .offset(0)
        .orderBy('created_at', 'desc')
        .build();
      
      expect(query.type).toBe('goal');
      expect(query.dimensions).toEqual({ status: 'open' });
      expect(query.limit).toBe(10);
      expect(query.offset).toBe(0);
      expect(query.order_by).toBe('created_at');
      expect(query.order_direction).toBe('desc');
    });

    it('should support parent/child/related filters', () => {
      const query = blackboardQuery()
        .parent('parent-id')
        .child('child-id')
        .related('related-id')
        .build();
      
      expect(query.parent_id).toBe('parent-id');
      expect(query.child_id).toBe('child-id');
      expect(query.related_id).toBe('related-id');
    });

    it('should support date filters', () => {
      const after = new Date('2024-01-01');
      const before = new Date('2024-12-31');
      
      const query = blackboardQuery()
        .createdAfter(after)
        .createdBefore(before)
        .build();
      
      expect(query.created_after).toEqual(after);
      expect(query.created_before).toEqual(before);
    });
  });
});

