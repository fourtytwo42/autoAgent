import { blackboardService } from './service';
import { jobQueue } from '@/src/jobs/queue';
import { agentRegistry } from '@/src/agents/registry';
import { WeSpeakerAgent } from '@/src/agents/agents/wespeaker.agent';
import { eventsRepository } from '@/src/db/repositories/events.repository';

/**
 * Create a user query request that will be handled by WeSpeaker
 * Workers can call this when they need information from the user
 */
export async function createUserQueryRequest(
  taskId: string,
  question: string,
  context?: string
): Promise<string> {
  // Get the task to find the goal
  const task = await blackboardService.findById(taskId);
  if (!task) {
    throw new Error(`Task ${taskId} not found`);
  }

  const goalId = task.links.parents?.[0];
  if (!goalId) {
    throw new Error(`Task ${taskId} has no parent goal`);
  }

  // Create a user_query_request item in the blackboard
  const queryRequest = await blackboardService.create({
    type: 'user_query_request',
    summary: question,
    dimensions: {
      task_id: taskId,
      goal_id: goalId,
      status: 'pending',
      context: context || '',
    },
    links: {
      parents: [goalId, taskId],
    },
    detail: {
      question,
      context: context || '',
      requested_at: new Date().toISOString(),
    },
  });

  // Trigger WeSpeaker to ask the user
  const agentType = await agentRegistry.getAgent('WeSpeaker');
  if (!agentType) {
    throw new Error('WeSpeaker agent not found');
  }

  const agent = new WeSpeakerAgent(agentType);
  const goal = await blackboardService.findById(goalId);
  
  const message = `The system needs some information to continue working on your request: "${goal?.summary || 'your request'}".

Question: ${question}

${context ? `Context: ${context}` : ''}

Please provide this information so we can continue.`;

  // Create a job for WeSpeaker to ask the user
  await jobQueue.createRunAgentJob(
    'WeSpeaker',
    {
      goal_id: goalId,
      message,
      user_query_request_id: queryRequest.id,
      task_id: taskId,
    },
    {
      temperature: 0.7,
      maxTokens: 20000,
    }
  );

  await eventsRepository.create({
    type: 'user_query_requested',
    blackboard_item_id: queryRequest.id,
    data: {
      task_id: taskId,
      goal_id: goalId,
      question,
    },
  });

  return queryRequest.id;
}

/**
 * Check if there's a pending user query request for a task
 */
export async function getPendingUserQueryRequest(taskId: string): Promise<any | null> {
  const requests = await blackboardService.query({
    type: 'user_query_request',
    dimensions: {
      task_id: taskId,
      status: 'pending',
    },
  });

  return requests.length > 0 ? requests[0] : null;
}

/**
 * Mark a user query request as answered
 */
export async function markUserQueryAnswered(
  queryRequestId: string,
  answer: string
): Promise<void> {
  await blackboardService.update(queryRequestId, {
    dimensions: {
      status: 'answered',
    },
    detail: {
      answer,
      answered_at: new Date().toISOString(),
    },
  });

  // Get the task ID from the query request
  const queryRequest = await blackboardService.findById(queryRequestId);
  if (!queryRequest) {
    return;
  }

  const taskId = queryRequest.dimensions?.task_id as string;
  if (!taskId) {
    return;
  }

  // Create a user_response item linked to the task
  await blackboardService.create({
    type: 'user_response',
    summary: answer,
    dimensions: {
      task_id: taskId,
      query_request_id: queryRequestId,
      status: 'answered',
    },
    links: {
      parents: [taskId, queryRequestId],
    },
    detail: {
      answer,
      question: queryRequest.summary,
      answered_at: new Date().toISOString(),
    },
  });

  // Resume the task by creating a new job for the worker
  // The worker should check for user responses and continue
  const task = await blackboardService.findById(taskId);
  if (task) {
    const assignedAgent = task.dimensions?.assigned_agent as string;
    if (assignedAgent) {
      // Create a continuation job for the worker
      await jobQueue.createRunAgentJob(
        assignedAgent,
        {
          task_id: taskId,
          goal_id: task.links.parents?.[0],
          task_summary: task.summary,
          user_response: answer,
          user_query_request_id: queryRequestId,
          continuation: true,
        },
        {
          temperature: 0.7,
          maxTokens: 20000,
        }
      );
    }
  }
}

