import { NextRequest, NextResponse } from 'next/server';
import { blackboardService } from '@/src/blackboard/service';
import { getDatabasePool } from '@/src/config/database';
import { jobQueue } from '@/src/jobs/queue';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const pool = getDatabasePool();
    
    // First, cancel all running and pending jobs
    const runningJobs = await jobQueue.getRunningJobs(1000);
    const pendingJobs = await jobQueue.getPendingJobs(1000);
    const allJobs = [...runningJobs, ...pendingJobs];
    
    let cancelledJobs = 0;
    for (const job of allJobs) {
      // Fail the job (which effectively cancels it)
      try {
        await jobQueue.failJob(job.id, true); // true = permanent failure
        cancelledJobs++;
      } catch (error) {
        console.error(`Error cancelling job ${job.id}:`, error);
      }
    }
    
    // Clear all items that agents could be working on
    const typesToClear = ['task', 'goal', 'user_request', 'agent_output'];
    
    let totalDeleted = 0;
    const deletedByType: Record<string, number> = {};
    
    for (const type of typesToClear) {
      // Get all items of this type
      const items = await blackboardService.query({ type: type as any, limit: 10000 });
      
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
          totalDeleted++;
        }
      }
      
      deletedByType[type] = deletedCount;
    }
    
    return NextResponse.json({ 
      success: true, 
      totalDeleted,
      cancelledJobs,
      deletedByType,
      message: `Cleared ${totalDeleted} items and cancelled ${cancelledJobs} jobs (tasks, goals, user requests, agent outputs)`
    });
  } catch (error) {
    console.error('Error clearing all agent work:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

