import { BlackboardItem } from '@/src/types/blackboard';
import { blackboardService } from '@/src/blackboard/service';
import { agentRegistry } from '@/src/agents/registry';
import { WeSpeakerAgent } from '@/src/agents/agents/wespeaker.agent';
import { TaskPlannerAgent } from '@/src/agents/agents/taskPlanner.agent';
import { GoalRefinerAgent } from '@/src/agents/agents/goalRefiner.agent';
import { JudgeAgent } from '@/src/agents/agents/judge.agent';
import { StewardAgent } from '@/src/agents/agents/steward.agent';
import { modelRouter } from '@/src/models/router';
import { jobQueue } from '@/src/jobs/queue';
import { jobScheduler } from '@/src/jobs/scheduler';
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
    const webEnabled = request.metadata?.web_enabled === true;
    const mergedMetadata = {
      ...(request.metadata || {}),
      web_enabled: webEnabled,
    };

    // Create user request in blackboard
    const userRequest = await blackboardService.createUserRequest(request.message, mergedMetadata);

    // Log event
    await eventsRepository.create({
      type: 'goal_created',
      blackboard_item_id: userRequest.id,
      data: {
        type: 'user_request',
        message: request.message,
      },
    });

    // Step 1: Use GoalRefiner to refine the user request into a proper goal
    const goalRefinerType = await agentRegistry.getAgent('GoalRefiner');
    if (!goalRefinerType) {
      throw new Error('GoalRefiner agent not found');
    }
    const goalRefiner = new GoalRefinerAgent(goalRefinerType);
    
    const refinedGoalOutput = await goalRefiner.execute({
      agent_id: 'GoalRefiner',
      model_id: '',
      input: {
        user_request: request.message,
        user_request_id: userRequest.id,
        web_enabled: webEnabled,
      },
      options: {
        temperature: 0.6,
        maxTokens: 500,
      },
    });

    // Extract refined goal text (clean up any markdown or formatting)
    const refinedGoalText = refinedGoalOutput.output.trim().replace(/^["']|["']$/g, '');

    // Step 2: Create goal from refined output
    const goal = await blackboardService.createGoal(
      refinedGoalText,
      userRequest.id,
      {
        status: 'open',
        priority: 'high',
        source: 'user',
        web_enabled: webEnabled,
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

    // Step 3: Run TaskPlanner to create tasks for this goal and wait for completion
    const taskPlannerJob = await jobQueue.createRunAgentJob(
      'TaskPlanner',
      {
        goal_id: goal.id,
        goal_summary: goal.summary,
        web_enabled: webEnabled,
      }
    );

    // Process TaskPlanner job immediately and wait for it to complete
    await jobScheduler.processJobImmediately(taskPlannerJob.id);
    
    // Wait for tasks to be created (poll with timeout)
    let tasks = await blackboardService.findChildren(goal.id);
    let attempts = 0;
    const maxAttempts = 20; // 10 seconds max wait
    while (tasks.length === 0 && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 500));
      tasks = await blackboardService.findChildren(goal.id);
      attempts++;
    }

    // Step 4: Execute tasks (create jobs for Worker agents)
    // Tasks are automatically assigned to agents via TaskManager.createTask
    // But we should wait a bit for them to start processing
    // For now, we'll let them run async and WeSpeaker will summarize what's planned

    // Step 5: Find WeSpeaker agent
    const agentType = await agentRegistry.getAgent('WeSpeaker');
    if (!agentType) {
      throw new Error('WeSpeaker agent not found');
    }

    // Create agent instance
    const agent = new WeSpeakerAgent(agentType);

    // Build context for WeSpeaker including task information
    const taskSummaries = tasks.map(t => `- ${t.summary}`).join('\n');
    const contextMessage = tasks.length > 0
      ? `${request.message}\n\nI've broken this down into ${tasks.length} tasks:\n${taskSummaries}\n\nPlease provide a helpful response to the user about what we're planning to do.`
      : request.message;

    // Execute WeSpeaker to get response
    const output = await agent.execute({
      agent_id: 'WeSpeaker',
      model_id: '', // Will be selected by agent
      input: {
        message: contextMessage,
        goal_id: goal.id,
        user_request_id: userRequest.id,
        task_count: tasks.length,
        web_enabled: webEnabled,
      },
      options: {
        temperature: 0.7,
        maxTokens: 1500,
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
        web_enabled: webEnabled,
      }
    );

    // Tasks already retrieved above

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
    const webEnabled = request.metadata?.web_enabled === true;
    const mergedMetadata = {
      ...(request.metadata || {}),
      web_enabled: webEnabled,
    };

    const userRequest = await blackboardService.createUserRequest(request.message, mergedMetadata);

    // Create goal from user request - use the message directly as the goal summary
    const goal = await blackboardService.createGoal(
      request.message,
      userRequest.id,
      {
        status: 'open',
        priority: 'high',
        source: 'user',
        web_enabled: webEnabled,
      }
    );

    // Run TaskPlanner async
    this.planTasksForGoal(goal.id, goal.summary, { web_enabled: webEnabled }).catch(console.error);

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
        web_enabled: webEnabled,
      },
      options: {
        temperature: 0.7,
        maxTokens: 1000,
      },
    });
  }

  private async planTasksForGoal(
    goalId: string,
    goalSummary: string,
    options?: { web_enabled?: boolean }
  ): Promise<void> {
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
        web_enabled: options?.web_enabled,
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
    const webEnabled = task.dimensions?.web_enabled ?? false;

    // Create job to run agent
    await jobQueue.createRunAgentJob(
      bestMatch.agent.id,
      {
        task_id: taskId,
        goal_id: task.links.parents?.[0],
        context: {
          task_summary: task.summary,
          task_dimensions: task.dimensions,
          web_enabled: webEnabled,
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
