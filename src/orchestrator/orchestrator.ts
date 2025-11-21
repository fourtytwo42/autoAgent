import { BlackboardItem } from '@/src/types/blackboard';
import { blackboardService } from '@/src/blackboard/service';
import { agentRegistry } from '@/src/agents/registry';
import { WeSpeakerAgent } from '@/src/agents/agents/wespeaker.agent';
import { TaskPlannerAgent } from '@/src/agents/agents/taskPlanner.agent';
import { JudgeAgent } from '@/src/agents/agents/judge.agent';
import { StewardAgent } from '@/src/agents/agents/steward.agent';
import { modelRouter } from '@/src/models/router';
import { jobQueue } from '@/src/jobs/queue';
import { eventsRepository } from '@/src/db/repositories/events.repository';
import { interestMatcher } from '@/src/agents/matcher';

export interface UserRequest {
  message: string;
  metadata?: Record<string, any>;
}

export interface ConversationResponse {
  response: string;
  goalId?: string;
  taskIds?: string[];
  metadata?: Record<string, any>;
}

export class Orchestrator {
  async handleUserRequest(request: UserRequest): Promise<ConversationResponse> {
    // Create user request in blackboard
    const userRequest = await blackboardService.createUserRequest(request.message, request.metadata);

    // Log event
    await eventsRepository.create({
      type: 'goal_created',
      blackboard_item_id: userRequest.id,
      data: {
        type: 'user_request',
        message: request.message,
      },
    });

    // Create goal from user request
    const goal = await blackboardService.createGoal(
      `User request: ${request.message}`,
      userRequest.id,
      {
        status: 'open',
        priority: 'high',
        source: 'user',
      }
    );

    // Log event
    await eventsRepository.create({
      type: 'goal_created',
      blackboard_item_id: goal.id,
      data: {
        parent_id: userRequest.id,
      },
    });

    // Run Steward to prioritize goals (async, don't wait)
    this.runStewardAsync();

    // Run TaskPlanner to create tasks for this goal
    await this.planTasksForGoal(goal.id, goal.summary);

    // Find WeSpeaker agent
    const agentType = await agentRegistry.getAgent('WeSpeaker');
    if (!agentType) {
      throw new Error('WeSpeaker agent not found');
    }

    // Create agent instance
    const agent = new WeSpeakerAgent(agentType);

    // Execute WeSpeaker to get response
    const output = await agent.execute({
      agent_id: 'WeSpeaker',
      model_id: '', // Will be selected by agent
      input: {
        message: request.message,
        goal_id: goal.id,
        user_request_id: userRequest.id,
      },
      options: {
        temperature: 0.7,
        maxTokens: 1000,
      },
    });

    // Save agent output to blackboard
    const agentOutput = await blackboardService.createAgentOutput(
      output.agent_id,
      output.model_id,
      goal.id,
      output.output,
      output.metadata
    );

    // Schedule Judge to evaluate the output
    await jobQueue.createRunAgentJob(
      'Judge',
      {
        agent_output_id: agentOutput.id,
        agent_output: output.output,
        task_summary: goal.summary,
        agent_id: output.agent_id,
      }
    );

    // Get tasks created for this goal
    const tasks = await blackboardService.findChildren(goal.id);

    // Log event
    await eventsRepository.create({
      type: 'agent_run',
      agent_id: output.agent_id,
      model_id: output.model_id,
      blackboard_item_id: agentOutput.id,
      data: {
        latency_ms: output.latency_ms,
      },
    });

    return {
      response: output.output,
      goalId: goal.id,
      taskIds: tasks.map((t) => t.id),
      metadata: {
        agent_id: output.agent_id,
        model_id: output.model_id,
        latency_ms: output.latency_ms,
      },
    };
  }

  async *handleUserRequestStream(request: UserRequest): AsyncIterable<string> {
    // Create user request in blackboard
    const userRequest = await blackboardService.createUserRequest(request.message, request.metadata);

    // Create goal from user request
    const goal = await blackboardService.createGoal(
      `User request: ${request.message}`,
      userRequest.id,
      {
        status: 'open',
        priority: 'high',
        source: 'user',
      }
    );

    // Run TaskPlanner async
    this.planTasksForGoal(goal.id, goal.summary).catch(console.error);

    // Find WeSpeaker agent
    const agentType = await agentRegistry.getAgent('WeSpeaker');
    if (!agentType) {
      throw new Error('WeSpeaker agent not found');
    }

    // Create agent instance
    const agent = new WeSpeakerAgent(agentType);

    // Execute WeSpeaker to stream response
    yield* agent.executeStream({
      agent_id: 'WeSpeaker',
      model_id: '', // Will be selected by agent
      input: {
        message: request.message,
        goal_id: goal.id,
        user_request_id: userRequest.id,
      },
      options: {
        temperature: 0.7,
        maxTokens: 1000,
      },
    });
  }

  private async planTasksForGoal(goalId: string, goalSummary: string): Promise<void> {
    // Check if tasks already exist for this goal
    const existingTasks = await blackboardService.findChildren(goalId);
    if (existingTasks.length > 0) {
      return; // Tasks already exist
    }

    // Create job for TaskPlanner
    await jobQueue.createRunAgentJob(
      'TaskPlanner',
      {
        goal_id: goalId,
        goal_summary: goalSummary,
      }
    );
  }

  private async runStewardAsync(): Promise<void> {
    // Run Steward periodically to manage goal priorities
    // This runs asynchronously and doesn't block the user request
    jobQueue.createRunAgentJob('Steward', {}).catch(console.error);
  }

  async processTask(taskId: string): Promise<void> {
    const task = await blackboardService.findById(taskId);
    if (!task || task.type !== 'task') {
      throw new Error(`Task ${taskId} not found`);
    }

    // Find matching agents
    const agents = await agentRegistry.getEnabledAgents();
    const matches = interestMatcher.match(agents, task);

    if (matches.length === 0) {
      throw new Error(`No agents match task ${taskId}`);
    }

    // Use best matching agent
    const bestMatch = matches[0];

    // Create job to run agent
    await jobQueue.createRunAgentJob(
      bestMatch.agent.id,
      {
        task_id: taskId,
        goal_id: task.links.parents?.[0],
        context: {
          task_summary: task.summary,
          task_dimensions: task.dimensions,
        },
      },
      {
        temperature: 0.7,
        maxTokens: 2000,
      }
    );
  }
}

export const orchestrator = new Orchestrator();
