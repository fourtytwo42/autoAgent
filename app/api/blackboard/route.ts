import { NextRequest, NextResponse } from 'next/server';
import { blackboardService } from '@/src/blackboard/service';
import { BlackboardQuery } from '@/src/types/blackboard';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Parse query parameters
    const type = searchParams.get('type');
    const summary = searchParams.get('summary');
    const parentId = searchParams.get('parent_id');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');
    const orderBy = searchParams.get('order_by');
    const orderDirection = searchParams.get('order_direction');

    const query: BlackboardQuery = {};

    if (type) {
      query.type = type as any;
    }

    if (summary) {
      query.summary = summary;
    }

    if (parentId) {
      query.parent_id = parentId;
    }

    if (limit) {
      query.limit = parseInt(limit, 10);
    }

    if (offset) {
      query.offset = parseInt(offset, 10);
    }

    if (orderBy) {
      query.order_by = orderBy as 'created_at' | 'updated_at';
    }

    if (orderDirection) {
      query.order_direction = orderDirection as 'asc' | 'desc';
    }

    const items = await blackboardService.query(query);

    return NextResponse.json({ items, count: items.length });
  } catch (error) {
    console.error('Error in blackboard API:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, summary, dimensions, links, detail } = body;

    if (!type || !summary) {
      return NextResponse.json(
        { error: 'Type and summary are required' },
        { status: 400 }
      );
    }

    const item = await blackboardService.create({
      type,
      summary,
      dimensions: dimensions || {},
      links: links || {},
      detail: detail || undefined,
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error('Error in blackboard API:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

