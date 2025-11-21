import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { withFreshDb } from '../../helpers/db';
import { Pool } from 'pg';
import { fixtureBlackboardItems, BlackboardItem } from '../../fixtures/blackboard';
import { assertBlackboardItemStructure } from '../../helpers/testUtils';

/**
 * Integration test for blackboard CRUD operations
 */
describe('Blackboard CRUD Operations', () => {
  let db: Pool;

  beforeEach(async () => {
    await withFreshDb(async (database) => {
      db = database;
    });
  });

  afterEach(async () => {
    if (db) {
      await db.end();
    }
  });

  it('should create a blackboard item', async () => {
    await withFreshDb(async (database) => {
      const item = fixtureBlackboardItems.userRequest('Test user request');
      
      const result = await database.query(
        `INSERT INTO blackboard_items (id, type, summary, dimensions, links, detail, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, now(), now())
         RETURNING *`,
        [
          item.id,
          item.type,
          item.summary,
          JSON.stringify(item.dimensions),
          JSON.stringify(item.links),
          item.detail ? JSON.stringify(item.detail) : null,
        ]
      );

      expect(result.rows).toHaveLength(1);
      const created = result.rows[0];
      expect(created.id).toBe(item.id);
      expect(created.type).toBe('user_request');
      expect(created.summary).toBe('Test user request');
    });
  });

  it('should read a blackboard item by id', async () => {
    await withFreshDb(async (database) => {
      const item = fixtureBlackboardItems.userRequest('Test user request');
      
      // Create item
      await database.query(
        `INSERT INTO blackboard_items (id, type, summary, dimensions, links)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          item.id,
          item.type,
          item.summary,
          JSON.stringify(item.dimensions),
          JSON.stringify(item.links),
        ]
      );

      // Read item
      const result = await database.query(
        'SELECT * FROM blackboard_items WHERE id = $1',
        [item.id]
      );

      expect(result.rows).toHaveLength(1);
      const read = result.rows[0];
      expect(read.id).toBe(item.id);
      expect(read.summary).toBe('Test user request');
    });
  });

  it('should update a blackboard item', async () => {
    await withFreshDb(async (database) => {
      const item = fixtureBlackboardItems.userRequest('Original request');
      
      // Create item
      await database.query(
        `INSERT INTO blackboard_items (id, type, summary, dimensions, links)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          item.id,
          item.type,
          item.summary,
          JSON.stringify(item.dimensions),
          JSON.stringify(item.links),
        ]
      );

      // Update item
      await database.query(
        `UPDATE blackboard_items 
         SET summary = $1, updated_at = now()
         WHERE id = $2`,
        ['Updated request', item.id]
      );

      // Verify update
      const result = await database.query(
        'SELECT * FROM blackboard_items WHERE id = $1',
        [item.id]
      );

      expect(result.rows[0].summary).toBe('Updated request');
    });
  });

  it('should delete a blackboard item', async () => {
    await withFreshDb(async (database) => {
      const item = fixtureBlackboardItems.userRequest('Test request');
      
      // Create item
      await database.query(
        `INSERT INTO blackboard_items (id, type, summary, dimensions, links)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          item.id,
          item.type,
          item.summary,
          JSON.stringify(item.dimensions),
          JSON.stringify(item.links),
        ]
      );

      // Delete item
      await database.query(
        'DELETE FROM blackboard_items WHERE id = $1',
        [item.id]
      );

      // Verify deletion
      const result = await database.query(
        'SELECT * FROM blackboard_items WHERE id = $1',
        [item.id]
      );

      expect(result.rows).toHaveLength(0);
    });
  });

  it('should query blackboard items by type', async () => {
    await withFreshDb(async (database) => {
      const request1 = fixtureBlackboardItems.userRequest('Request 1');
      const request2 = fixtureBlackboardItems.userRequest('Request 2');
      const goal = fixtureBlackboardItems.goal('Goal 1');
      
      // Create items
      await Promise.all([
        database.query(
          `INSERT INTO blackboard_items (id, type, summary, dimensions, links)
           VALUES ($1, $2, $3, $4, $5)`,
          [request1.id, request1.type, request1.summary, JSON.stringify(request1.dimensions), JSON.stringify(request1.links)]
        ),
        database.query(
          `INSERT INTO blackboard_items (id, type, summary, dimensions, links)
           VALUES ($1, $2, $3, $4, $5)`,
          [request2.id, request2.type, request2.summary, JSON.stringify(request2.dimensions), JSON.stringify(request2.links)]
        ),
        database.query(
          `INSERT INTO blackboard_items (id, type, summary, dimensions, links)
           VALUES ($1, $2, $3, $4, $5)`,
          [goal.id, goal.type, goal.summary, JSON.stringify(goal.dimensions), JSON.stringify(goal.links)]
        ),
      ]);

      // Query by type
      const result = await database.query(
        "SELECT * FROM blackboard_items WHERE type = 'user_request' ORDER BY created_at"
      );

      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].type).toBe('user_request');
      expect(result.rows[1].type).toBe('user_request');
    });
  });

  it('should handle links between blackboard items', async () => {
    await withFreshDb(async (database) => {
      const goal = fixtureBlackboardItems.goal('Test goal');
      const task = fixtureBlackboardItems.task('Test task', goal.id);
      
      // Create goal
      await database.query(
        `INSERT INTO blackboard_items (id, type, summary, dimensions, links)
         VALUES ($1, $2, $3, $4, $5)`,
        [goal.id, goal.type, goal.summary, JSON.stringify(goal.dimensions), JSON.stringify(goal.links)]
      );

      // Create task with parent link
      await database.query(
        `INSERT INTO blackboard_items (id, type, summary, dimensions, links)
         VALUES ($1, $2, $3, $4, $5)`,
        [task.id, task.type, task.summary, JSON.stringify(task.dimensions), JSON.stringify(task.links)]
      );

      // Query task and verify link
      const result = await database.query(
        'SELECT * FROM blackboard_items WHERE id = $1',
        [task.id]
      );

      const retrieved = result.rows[0];
      const links = JSON.parse(retrieved.links);
      expect(links.parents).toContain(goal.id);
    });
  });

  it('should validate blackboard item structure', () => {
    const item = fixtureBlackboardItems.userRequest('Test');
    expect(() => assertBlackboardItemStructure(item)).not.toThrow();
  });
});

