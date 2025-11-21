import { blackboardService } from '@/src/blackboard/service';
import { jobQueue } from '@/src/jobs/queue';
import { eventsRepository } from '@/src/db/repositories/events.repository';
import { getDatabasePool } from '@/src/config/database';

/**
 * Clean up completed tasks after WeSpeaker has provided final response
 * This should be called after WeSpeaker completes its response for a goal
 */
export async function cleanupCompletedTasks(goalId: string): Promise<void> {
  try {
    // Get all tasks for this goal
    const tasks = await blackboardService.findChildren(goalId);
    const taskItems = tasks.filter(t => t.type === 'task' && t.dimensions?.status === 'completed');

    if (taskItems.length === 0) {
      return;
    }

    const pool = getDatabasePool();
    let deletedCount = 0;

    // Delete completed tasks and their related data
    for (const task of taskItems) {
      // Get all agent outputs for this task
      const outputs = await blackboardService.query({
        type: 'agent_output',
        parent_id: task.id,
      });

      // Delete judgements for these outputs
      for (const output of outputs) {
        const judgements = await blackboardService.query({
          type: 'judgement',
          parent_id: output.id,
        });

        for (const judgement of judgements) {
          // Delete events for judgements
          await pool.query(
            'DELETE FROM events WHERE blackboard_item_id = $1',
            [judgement.id]
          );
          await blackboardService.delete(judgement.id);
        }

        // Delete events for outputs
        await pool.query(
          'DELETE FROM events WHERE blackboard_item_id = $1',
          [output.id]
        );
        await blackboardService.delete(output.id);
      }

      // Delete events for task
      await pool.query(
        'DELETE FROM events WHERE blackboard_item_id = $1',
        [task.id]
      );

      // Delete the task
      const deleted = await blackboardService.delete(task.id);
      if (deleted) {
        deletedCount++;
      }
    }

    console.log(`Cleaned up ${deletedCount} completed tasks for goal ${goalId}`);
  } catch (error) {
    console.error('Error cleaning up completed tasks:', error);
  }
}

/**
 * Unlock and fail jobs that have been stuck in running state for too long
 */
export async function cleanupStuckJobs(maxAgeMinutes: number = 5): Promise<number> {
  try {
    const pool = getDatabasePool();
    const result = await pool.query(
      `UPDATE jobs 
       SET status = 'failed',
           locked_at = null,
           locked_by = null,
           updated_at = now()
       WHERE status = 'running' 
         AND locked_at < NOW() - INTERVAL '${maxAgeMinutes} minutes'
       RETURNING id`
    );

    const unlockedCount = result.rows.length;
    if (unlockedCount > 0) {
      console.log(`Unlocked ${unlockedCount} stuck jobs`);
    }

    return unlockedCount;
  } catch (error) {
    console.error('Error cleaning up stuck jobs:', error);
    return 0;
  }
}

