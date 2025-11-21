import { NextRequest, NextResponse } from 'next/server';
import { blackboardService } from '@/src/blackboard/service';
import { eventsRepository } from '@/src/db/repositories/events.repository';
import { getDatabasePool } from '@/src/config/database';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Delete all user_request and agent_output items (WeSpeaker only)
    const userRequests = await blackboardService.query({ type: 'user_request' });
    const agentOutputs = await blackboardService.query({ 
      type: 'agent_output',
      dimensions: { agent_id: 'WeSpeaker' }
    });

    const pool = getDatabasePool();
    let deletedCount = 0;

    // Delete user requests (and their related events)
    for (const item of userRequests) {
      // Delete events referencing this item
      await pool.query(
        'DELETE FROM events WHERE blackboard_item_id = $1',
        [item.id]
      );
      
      const deleted = await blackboardService.delete(item.id);
      if (deleted) {
        deletedCount++;
      }
    }

    // Delete WeSpeaker agent outputs (and their related events)
    for (const item of agentOutputs) {
      // Delete events referencing this item
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
      message: `Cleared ${deletedCount} conversation items`
    });
  } catch (error) {
    console.error('Error clearing conversation:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

