import { BlackboardQuery, BlackboardItemType } from '@/src/types/blackboard';

export class BlackboardQueryBuilder {
  private query: BlackboardQuery = {};

  type(type: BlackboardItemType | BlackboardItemType[]): this {
    this.query.type = type;
    return this;
  }

  dimensions(dimensions: Record<string, any>): this {
    this.query.dimensions = { ...this.query.dimensions, ...dimensions };
    return this;
  }

  summary(search: string): this {
    this.query.summary = search;
    return this;
  }

  parent(parentId: string): this {
    this.query.parent_id = parentId;
    return this;
  }

  child(childId: string): this {
    this.query.child_id = childId;
    return this;
  }

  related(relatedId: string): this {
    this.query.related_id = relatedId;
    return this;
  }

  createdAfter(date: Date): this {
    this.query.created_after = date;
    return this;
  }

  createdBefore(date: Date): this {
    this.query.created_before = date;
    return this;
  }

  limit(count: number): this {
    this.query.limit = count;
    return this;
  }

  offset(count: number): this {
    this.query.offset = count;
    return this;
  }

  orderBy(field: 'created_at' | 'updated_at', direction: 'asc' | 'desc' = 'desc'): this {
    this.query.order_by = field;
    this.query.order_direction = direction;
    return this;
  }

  build(): BlackboardQuery {
    return { ...this.query };
  }
}

export function blackboardQuery(): BlackboardQueryBuilder {
  return new BlackboardQueryBuilder();
}

