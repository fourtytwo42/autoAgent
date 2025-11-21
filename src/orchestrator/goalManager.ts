import { BlackboardItem } from '@/src/types/blackboard';
import { blackboardService } from '@/src/blackboard/service';
import { eventsRepository } from '@/src/db/repositories/events.repository';

export class GoalManager {
  async createGoal(summary: string, parentId?: string, metadata?: Record<string, any>): Promise<BlackboardItem> {
    const goal = await blackboardService.createGoal(summary, parentId, metadata);

    await eventsRepository.create({
      type: 'goal_created',
      blackboard_item_id: goal.id,
      data: {
        parent_id: parentId,
        summary,
        metadata,
      },
    });

    return goal;
  }

  async getGoal(id: string): Promise<BlackboardItem | null> {
    return blackboardService.findById(id);
  }

  async getOpenGoals(): Promise<BlackboardItem[]> {
    return blackboardService.query({
      type: 'goal',
      dimensions: { status: 'open' },
    });
  }

  async updateGoalStatus(id: string, status: string): Promise<BlackboardItem | null> {
    const updated = await blackboardService.update(id, {
      dimensions: { status },
    });

    if (updated) {
      await eventsRepository.create({
        type: 'goal_created', // TODO: Add goal_updated event type
        blackboard_item_id: id,
        data: { status },
      });
    }

    return updated;
  }

  async closeGoal(id: string): Promise<BlackboardItem | null> {
    return this.updateGoalStatus(id, 'closed');
  }
}

export const goalManager = new GoalManager();

