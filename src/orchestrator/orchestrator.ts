import { BlackboardItem } from '@/src/types/blackboard';
import { blackboardService } from '@/src/blackboard/service';
import { agentRegistry } from '@/src/agents/registry';
import { WeSpeakerAgent } from '@/src/agents/agents/wespeaker.agent';
import { modelRouter } from '@/src/models/router';
import { jobQueue } from '@/src/jobs/queue';
import { eventsRepository } from '@/src/db/repositories/events.repository';

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
}

export const orchestrator = new Orchestrator();

