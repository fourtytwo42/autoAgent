import { blackboardService } from '@/src/blackboard/service';
import { jobQueue } from '@/src/jobs/queue';
import { eventsRepository } from '@/src/db/repositories/events.repository';

export type SelfGoalType = 'maintenance' | 'improvement' | 'exploration';

export interface SelfGoal {
  type: SelfGoalType;
  summary: string;
  priority: 'low' | 'medium' | 'high';
  metadata?: Record<string, any>;
}

export class SelfGoalsManager {
  /**
   * Create self-goals for system maintenance
   */
  async createMaintenanceGoals(): Promise<string[]> {
    const goals: SelfGoal[] = [
      {
        type: 'maintenance',
        summary: 'Review and clean up old blackboard items',
        priority: 'low',
      },
      {
        type: 'maintenance',
        summary: 'Update model quality scores based on recent judgements',
        priority: 'medium',
      },
      {
        type: 'maintenance',
        summary: 'Review and optimize agent performance metrics',
        priority: 'low',
      },
    ];

    const goalIds: string[] = [];

    for (const goalSpec of goals) {
      const goal = await blackboardService.createGoal(goalSpec.summary, undefined, {
        status: 'open',
        priority: goalSpec.priority,
        source: 'system',
        self_goal_type: goalSpec.type,
        ...goalSpec.metadata,
      });

      goalIds.push(goal.id);

      await eventsRepository.create({
        type: 'goal_created',
        blackboard_item_id: goal.id,
        data: {
          type: 'self_goal',
          self_goal_type: goalSpec.type,
        },
      });
    }

    return goalIds;
  }

  /**
   * Create self-goals for system improvement
   */
  async createImprovementGoals(): Promise<string[]> {
    const goals: SelfGoal[] = [
      {
        type: 'improvement',
        summary: 'Analyze agent performance and suggest improvements',
        priority: 'medium',
      },
      {
        type: 'improvement',
        summary: 'Evaluate model routing effectiveness',
        priority: 'medium',
      },
      {
        type: 'improvement',
        summary: 'Identify bottlenecks in task execution',
        priority: 'high',
      },
    ];

    const goalIds: string[] = [];

    for (const goalSpec of goals) {
      const goal = await blackboardService.createGoal(goalSpec.summary, undefined, {
        status: 'open',
        priority: goalSpec.priority,
        source: 'system',
        self_goal_type: goalSpec.type,
        ...goalSpec.metadata,
      });

      goalIds.push(goal.id);
    }

    return goalIds;
  }

  /**
   * Create self-goals for exploration
   */
  async createExplorationGoals(): Promise<string[]> {
    const goals: SelfGoal[] = [
      {
        type: 'exploration',
        summary: 'Explore new model capabilities and use cases',
        priority: 'low',
      },
      {
        type: 'exploration',
        summary: 'Test ensemble model calls for critical tasks',
        priority: 'medium',
      },
    ];

    const goalIds: string[] = [];

    for (const goalSpec of goals) {
      const goal = await blackboardService.createGoal(goalSpec.summary, undefined, {
        status: 'open',
        priority: goalSpec.priority,
        source: 'system',
        self_goal_type: goalSpec.type,
        ...goalSpec.metadata,
      });

      goalIds.push(goal.id);
    }

    return goalIds;
  }

  /**
   * Create all self-goals
   */
  async createAllSelfGoals(): Promise<string[]> {
    const maintenance = await this.createMaintenanceGoals();
    const improvement = await this.createImprovementGoals();
    const exploration = await this.createExplorationGoals();

    return [...maintenance, ...improvement, ...exploration];
  }

  /**
   * Schedule periodic self-goal creation
   */
  scheduleSelfGoals(intervalHours: number = 24): NodeJS.Timeout {
    // Create self-goals immediately
    this.createAllSelfGoals().catch(console.error);

    // Then schedule periodic creation
    return setInterval(() => {
      this.createAllSelfGoals().catch(console.error);
    }, intervalHours * 60 * 60 * 1000);
  }
}

export const selfGoalsManager = new SelfGoalsManager();

