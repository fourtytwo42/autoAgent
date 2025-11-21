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

    // Check if there's a recent open goal (within last 30 minutes) to link this as a follow-up
    const recentGoals = await blackboardService.query({
      type: 'goal',
      dimensions: { status: 'open' },
      order_by: 'created_at',
      order_direction: 'desc',
      limit: 5,
    });

    let goal: BlackboardItem;
    let isFollowUp = false;

    // Check if any recent goal is related (within 30 minutes)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const recentOpenGoal = recentGoals.find(
      g => new Date(g.created_at || 0) > thirtyMinutesAgo
    );

    if (recentOpenGoal) {
      // This is a follow-up to an existing goal
      isFollowUp = true;
      goal = recentOpenGoal;
      
      // Link this user request to the existing goal
      await blackboardService.addLink(userRequest.id, goal.id, 'child');
      
      // Get conversation history for context
      const conversationHistory = await this.getConversationHistory(goal.id);
      
      // Step 1: Use GoalRefiner to refine the user request, including context
      const goalRefinerType = await agentRegistry.getAgent('GoalRefiner');
      if (!goalRefinerType) {
        throw new Error('GoalRefiner agent not found');
      }
      const goalRefiner = new GoalRefinerAgent(goalRefinerType);
      
      const contextMessage = conversationHistory.length > 0
        ? `Previous conversation:\n${conversationHistory.map(m => `${m.role}: ${m.content}`).join('\n')}\n\nNew user message: ${request.message}\n\nThis is a follow-up to the existing goal: ${goal.summary}`
        : `New user message: ${request.message}\n\nThis is a follow-up to the existing goal: ${goal.summary}`;
      
      const refinedGoalOutput = await goalRefiner.execute({
        agent_id: 'GoalRefiner',
        model_id: '',
        input: {
          user_request: contextMessage,
          user_request_id: userRequest.id,
          web_enabled: webEnabled,
        },
        options: {
          temperature: 0.6,
          maxTokens: 500,
        },
      });

      // Update goal summary with refined text if it's significantly different
      const refinedGoalText = refinedGoalOutput.output.trim().replace(/^["']|["']$/g, '');
      if (refinedGoalText.length > 20 && refinedGoalText !== goal.summary) {
        await blackboardService.update(goal.id, {
          summary: refinedGoalText,
        });
        goal.summary = refinedGoalText;
      }
    } else {
      // This is a new goal
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
      goal = await blackboardService.createGoal(
        refinedGoalText,
        userRequest.id,
        {
          status: 'open',
          priority: 'high',
          source: 'user',
          web_enabled: webEnabled,
        }
      );
    }

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

    // Step 3: Start TaskPlanner in the background (only if new goal, not follow-up)
    // Don't wait for it - let WeSpeaker respond immediately
    if (!isFollowUp) {
      jobQueue.createRunAgentJob(
        'TaskPlanner',
        {
          goal_id: goal.id,
          goal_summary: goal.summary,
          web_enabled: webEnabled,
        }
      ).then(async (taskPlannerJob) => {
        console.log(`[Orchestrator] Created TaskPlanner job ${taskPlannerJob.id} for goal ${goal.id}`);
        // Try to process immediately
        try {
          await jobScheduler.processJobImmediately(taskPlannerJob.id);
          console.log(`[Orchestrator] TaskPlanner job ${taskPlannerJob.id} processed immediately`);
        } catch (error) {
          console.log(`[Orchestrator] TaskPlanner job ${taskPlannerJob.id} will be processed by scheduler: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }).catch(error => {
        console.error('[Orchestrator] Error creating TaskPlanner job:', error);
      });
    }

    // Step 4: Find WeSpeaker agent and respond immediately
    // Don't wait for tasks - respond right away
    const agentType = await agentRegistry.getAgent('WeSpeaker');
    if (!agentType) {
      throw new Error('WeSpeaker agent not found');
    }

    // Create agent instance
    const agent = new WeSpeakerAgent(agentType);

    // Get conversation history for context
    const conversationHistory = await this.getConversationHistory(goal.id);
    
    // Build context for WeSpeaker - don't list tasks, just let it know work is happening
    const historyContext = conversationHistory.length > 0
      ? `\n\nPrevious conversation:\n${conversationHistory.map(m => `${m.role}: ${m.content}`).join('\n')}`
      : '';
    
    const contextMessage = isFollowUp
      ? `${request.message}${historyContext}\n\nThis is a follow-up to the goal: ${goal.summary}. Please provide a helpful response that acknowledges the previous conversation and addresses the new request naturally.`
      : `${request.message}${historyContext}\n\nPlease provide a natural, conversational response to the user. Acknowledge their request and let them know you're working on it, but don't list tasks or explain what needs to be done.`;

    // Execute WeSpeaker to get response immediately
    const output = await agent.execute({
      agent_id: 'WeSpeaker',
      model_id: '', // Will be selected by agent
      input: {
        message: contextMessage,
        goal_id: goal.id,
        user_request_id: userRequest.id,
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

    // Get tasks that may have been created by TaskPlanner (if any exist yet)
    const existingTasks = await blackboardService.findChildren(goal.id);
    const taskItems = existingTasks.filter(t => t.type === 'task');

    return {
      response: output.output,
      goalId: goal.id,
      taskIds: taskItems.map((t) => t.id),
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

  private async getConversationHistory(goalId: string): Promise<Array<{ role: string; content: string }>> {
    // Get all user requests and agent outputs related to this goal
    const goal = await blackboardService.findById(goalId);
    if (!goal) {
      return [];
    }

    // Get all user requests linked to this goal (via parent chain)
    const userRequests = await blackboardService.query({
      type: 'user_request',
      order_by: 'created_at',
      order_direction: 'asc',
      limit: 20,
    });

    // Get all WeSpeaker outputs
    const agentOutputs = await blackboardService.query({
      type: 'agent_output',
      dimensions: {
        agent_id: 'WeSpeaker',
      },
      order_by: 'created_at',
      order_direction: 'asc',
      limit: 20,
    });

    // Filter to only include items related to this goal (within last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const relatedItems = [...userRequests, ...agentOutputs]
      .filter(item => new Date(item.created_at || 0) > oneHourAgo)
      .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());

    // Convert to conversation format
    return relatedItems.map(item => {
      let content = item.summary || '';
      
      // For agent outputs, get the actual content from detail.content
      if (item.type === 'agent_output' && item.detail && typeof item.detail === 'object') {
        const detail = item.detail as any;
        if (detail.content && typeof detail.content === 'string') {
          content = detail.content;
        }
      }
      
      return {
        role: item.type === 'user_request' ? 'user' : 'assistant',
        content: content,
      };
    });
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
