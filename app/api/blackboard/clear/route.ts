import { NextRequest, NextResponse } from 'next/server';
import { blackboardService } from '@/src/blackboard/service';
import { getDatabasePool } from '@/src/config/database';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type } = body;

    // If type is provided, clear only that type; otherwise clear all
    let items;
    if (type) {
      items = await blackboardService.query({ type: type as any, limit: 10000 });
    } else {
      // Get all items
      items = await blackboardService.query({ limit: 10000 });
    }

    const pool = getDatabasePool();
    
    // Delete each item (and their related events)
    let deletedCount = 0;
    for (const item of items) {
      // Delete events referencing this item first
      await pool.query(
        'DELETE FROM events WHERE blackboard_item_id = $1',
        [item.id]
      );
      
      const deleted = await blackboardService.delete(item.id);
      if (deleted) {
        deletedCount++;
      }
    }

    return NextResponse.json({ 
      success: true, 
      deletedCount,
      message: type ? `Deleted ${deletedCount} items of type ${type}` : `Deleted ${deletedCount} items`
    });
  } catch (error) {
    console.error('Error clearing blackboard:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

