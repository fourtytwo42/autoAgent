import { Pool } from 'pg';
import { getDatabasePool } from '@/src/config/database';
import {
  BlackboardItem,
  BlackboardItemRow,
  BlackboardQuery,
  BlackboardItemType,
} from '@/src/types/blackboard';
import { randomUUID } from 'crypto';

export class BlackboardRepository {
  constructor(private pool: Pool = getDatabasePool()) {}

  async create(item: Omit<BlackboardItem, 'id' | 'created_at' | 'updated_at'>): Promise<BlackboardItemRow> {
    const id = randomUUID();
    const now = new Date();

    const result = await this.pool.query<BlackboardItemRow>(
      `INSERT INTO blackboard_items (id, type, summary, dimensions, links, detail, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        id,
        item.type,
        item.summary,
        JSON.stringify(item.dimensions || {}),
        JSON.stringify(item.links || {}),
        item.detail ? JSON.stringify(item.detail) : null,
        now,
        now,
      ]
    );

    return this.mapRow(result.rows[0]);
  }

  async findById(id: string): Promise<BlackboardItemRow | null> {
    const result = await this.pool.query<BlackboardItemRow>(
      'SELECT * FROM blackboard_items WHERE id = $1',
      [id]
    );

    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async query(query: BlackboardQuery): Promise<BlackboardItemRow[]> {
    let sql = 'SELECT * FROM blackboard_items WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (query.type) {
      if (Array.isArray(query.type)) {
        sql += ` AND type = ANY($${paramIndex++})`;
        params.push(query.type);
      } else {
        sql += ` AND type = $${paramIndex++}`;
        params.push(query.type);
      }
    }

    if (query.summary) {
      sql += ` AND summary ILIKE $${paramIndex++}`;
      params.push(`%${query.summary}%`);
    }

    if (query.dimensions) {
      // Query JSONB dimensions
      Object.entries(query.dimensions).forEach(([key, value]) => {
        sql += ` AND dimensions->>'${key}' = $${paramIndex++}`;
        params.push(String(value));
      });
    }

    if (query.parent_id) {
      sql += ` AND links->'parents' @> $${paramIndex++}::jsonb`;
      params.push(JSON.stringify([query.parent_id]));
    }

    if (query.child_id) {
      sql += ` AND links->'children' @> $${paramIndex++}::jsonb`;
      params.push(JSON.stringify([query.child_id]));
    }

    if (query.related_id) {
      sql += ` AND links->'related' @> $${paramIndex++}::jsonb`;
      params.push(JSON.stringify([query.related_id]));
    }

    if (query.created_after) {
      sql += ` AND created_at >= $${paramIndex++}`;
      params.push(query.created_after);
    }

    if (query.created_before) {
      sql += ` AND created_at <= $${paramIndex++}`;
      params.push(query.created_before);
    }

    const orderBy = query.order_by || 'created_at';
    const orderDirection = query.order_direction || 'desc';
    sql += ` ORDER BY ${orderBy} ${orderDirection.toUpperCase()}`;

    if (query.limit) {
      sql += ` LIMIT $${paramIndex++}`;
      params.push(query.limit);
    }

    if (query.offset) {
      sql += ` OFFSET $${paramIndex++}`;
      params.push(query.offset);
    }

    const result = await this.pool.query<BlackboardItemRow>(sql, params);
    return result.rows.map((row) => this.mapRow(row));
  }

  async update(
    id: string,
    updates: Partial<Omit<BlackboardItem, 'id' | 'created_at' | 'updated_at'>>
  ): Promise<BlackboardItemRow | null> {
    const updateFields: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (updates.type !== undefined) {
      updateFields.push(`type = $${paramIndex++}`);
      params.push(updates.type);
    }

    if (updates.summary !== undefined) {
      updateFields.push(`summary = $${paramIndex++}`);
      params.push(updates.summary);
    }

    if (updates.dimensions !== undefined) {
      updateFields.push(`dimensions = $${paramIndex++}`);
      params.push(JSON.stringify(updates.dimensions));
    }

    if (updates.links !== undefined) {
      updateFields.push(`links = $${paramIndex++}`);
      params.push(JSON.stringify(updates.links));
    }

    if (updates.detail !== undefined) {
      updateFields.push(`detail = $${paramIndex++}`);
      params.push(updates.detail ? JSON.stringify(updates.detail) : null);
    }

    if (updateFields.length === 0) {
      return this.findById(id);
    }

    updateFields.push(`updated_at = $${paramIndex++}`);
    params.push(new Date());
    params.push(id);

    const result = await this.pool.query<BlackboardItemRow>(
      `UPDATE blackboard_items SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM blackboard_items WHERE id = $1',
      [id]
    );

    return result.rowCount ? result.rowCount > 0 : false;
  }

  async addLink(fromId: string, toId: string, relation: 'parent' | 'child' | 'related'): Promise<boolean> {
    const item = await this.findById(fromId);
    if (!item) return false;

    const links = item.links || {};
    const linkKey = relation === 'parent' ? 'parents' : relation === 'child' ? 'children' : 'related';
    const linkArray = links[linkKey] || [];

    if (!linkArray.includes(toId)) {
      linkArray.push(toId);
      links[linkKey] = linkArray;

      await this.update(fromId, { links });
    }

    return true;
  }

  async removeLink(fromId: string, toId: string, relation: 'parent' | 'child' | 'related'): Promise<boolean> {
    const item = await this.findById(fromId);
    if (!item) return false;

    const links = item.links || {};
    const linkKey = relation === 'parent' ? 'parents' : relation === 'child' ? 'children' : 'related';
    const linkArray = links[linkKey] || [];

    const filtered = linkArray.filter((id: string) => id !== toId);
    links[linkKey] = filtered;

    await this.update(fromId, { links });

    return true;
  }

  private mapRow(row: any): BlackboardItemRow {
    return {
      ...row,
      dimensions: typeof row.dimensions === 'string' ? JSON.parse(row.dimensions) : row.dimensions,
      links: typeof row.links === 'string' ? JSON.parse(row.links) : row.links,
      detail: row.detail ? (typeof row.detail === 'string' ? JSON.parse(row.detail) : row.detail) : null,
    };
  }
}

export const blackboardRepository = new BlackboardRepository();

