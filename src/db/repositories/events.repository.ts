import { Pool } from 'pg';
import { getDatabasePool } from '@/src/config/database';
import { Event, EventRow, EventType } from '@/src/types/events';
import { randomUUID } from 'crypto';

export class EventsRepository {
  constructor(private pool: Pool = getDatabasePool()) {}

  async create(event: Omit<Event, 'id' | 'created_at'>): Promise<EventRow> {
    const id = randomUUID();
    const now = new Date();

    const result = await this.pool.query<EventRow>(
      `INSERT INTO events (
        id, type, agent_id, model_id, blackboard_item_id, job_id, data, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        id,
        event.type,
        event.agent_id || null,
        event.model_id || null,
        event.blackboard_item_id || null,
        event.job_id || null,
        JSON.stringify(event.data || {}),
        now,
      ]
    );

    return this.mapRow(result.rows[0]);
  }

  async findById(id: string): Promise<EventRow | null> {
    const result = await this.pool.query<EventRow>(
      'SELECT * FROM events WHERE id = $1',
      [id]
    );

    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async findByType(type: EventType, limit: number = 100): Promise<EventRow[]> {
    const result = await this.pool.query<EventRow>(
      'SELECT * FROM events WHERE type = $1 ORDER BY created_at DESC LIMIT $2',
      [type, limit]
    );

    return result.rows.map((row) => this.mapRow(row));
  }

  async findByAgentId(agentId: string, limit: number = 100): Promise<EventRow[]> {
    const result = await this.pool.query<EventRow>(
      'SELECT * FROM events WHERE agent_id = $1 ORDER BY created_at DESC LIMIT $2',
      [agentId, limit]
    );

    return result.rows.map((row) => this.mapRow(row));
  }

  async findByModelId(modelId: string, limit: number = 100): Promise<EventRow[]> {
    const result = await this.pool.query<EventRow>(
      'SELECT * FROM events WHERE model_id = $1 ORDER BY created_at DESC LIMIT $2',
      [modelId, limit]
    );

    return result.rows.map((row) => this.mapRow(row));
  }

  async findByBlackboardItemId(blackboardItemId: string, limit: number = 100): Promise<EventRow[]> {
    const result = await this.pool.query<EventRow>(
      'SELECT * FROM events WHERE blackboard_item_id = $1 ORDER BY created_at DESC LIMIT $2',
      [blackboardItemId, limit]
    );

    return result.rows.map((row) => this.mapRow(row));
  }

  async query(filters: {
    type?: EventType;
    agent_id?: string;
    model_id?: string;
    blackboard_item_id?: string;
    job_id?: string;
    created_after?: Date;
    created_before?: Date;
    limit?: number;
    offset?: number;
  }): Promise<EventRow[]> {
    let sql = 'SELECT * FROM events WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.type) {
      sql += ` AND type = $${paramIndex++}`;
      params.push(filters.type);
    }

    if (filters.agent_id) {
      sql += ` AND agent_id = $${paramIndex++}`;
      params.push(filters.agent_id);
    }

    if (filters.model_id) {
      sql += ` AND model_id = $${paramIndex++}`;
      params.push(filters.model_id);
    }

    if (filters.blackboard_item_id) {
      sql += ` AND blackboard_item_id = $${paramIndex++}`;
      params.push(filters.blackboard_item_id);
    }

    if (filters.job_id) {
      sql += ` AND job_id = $${paramIndex++}`;
      params.push(filters.job_id);
    }

    if (filters.created_after) {
      sql += ` AND created_at >= $${paramIndex++}`;
      params.push(filters.created_after);
    }

    if (filters.created_before) {
      sql += ` AND created_at <= $${paramIndex++}`;
      params.push(filters.created_before);
    }

    sql += ' ORDER BY created_at DESC';

    if (filters.limit) {
      sql += ` LIMIT $${paramIndex++}`;
      params.push(filters.limit);
    }

    if (filters.offset) {
      sql += ` OFFSET $${paramIndex++}`;
      params.push(filters.offset);
    }

    const result = await this.pool.query<EventRow>(sql, params);
    return result.rows.map((row) => this.mapRow(row));
  }

  private mapRow(row: any): EventRow {
    return {
      ...row,
      data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data,
    };
  }
}

export const eventsRepository = new EventsRepository();

