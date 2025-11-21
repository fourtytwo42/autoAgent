import { BaseJobProcessor } from './base.processor';
import { Job, JobType, RunAgentJobPayload } from '@/src/types/jobs';
import { agentRegistry } from '@/src/agents/registry';
import { WeSpeakerAgent } from '@/src/agents/agents/wespeaker.agent';
import { blackboardService } from '@/src/blackboard/service';
import { agentMetricsRepository } from '@/src/db/repositories/agentMetrics.repository';
import { eventsRepository } from '@/src/db/repositories/events.repository';

export class RunAgentProcessor extends BaseJobProcessor {
  type: JobType = 'run_agent';

  async process(job: Job): Promise<void> {
    const payload = job.payload as RunAgentJobPayload;

    if (!payload.agent_id) {
      throw new Error('agent_id is required in job payload');
    }

    // Load agent type
    const agentType = await agentRegistry.getAgent(payload.agent_id);
    if (!agentType) {
      throw new Error(`Agent ${payload.agent_id} not found`);
    }

    // Create agent instance (simplified - in production would use factory)
    let agent: any;
    switch (payload.agent_id) {
      case 'WeSpeaker':
        agent = new WeSpeakerAgent(agentType);
        break;
      default:
        throw new Error(`Unknown agent type: ${payload.agent_id}`);
    }

    // Execute agent
    const context = {
      agent_id: payload.agent_id,
      model_id: payload.model_id || '',
      input: payload.context || {},
      options: payload.options,
    };

    const output = await agent.execute(context);

    // Save agent output to blackboard if task_id provided
    if (payload.task_id) {
      await blackboardService.createAgentOutput(
        output.agent_id,
        output.model_id,
        payload.task_id,
        output.output,
        output.metadata
      );
    }

    // Update agent metrics
    await agentMetricsRepository.incrementUsage(output.agent_id);
    if (output.latency_ms) {
      await agentMetricsRepository.updateMetrics(output.agent_id, {
        avg_latency_ms: output.latency_ms, // Simplified - should calculate moving average
      });
    }

    // Log event
    await eventsRepository.create({
      type: 'agent_run',
      agent_id: output.agent_id,
      model_id: output.model_id,
      blackboard_item_id: payload.task_id || null,
      job_id: job.id,
      data: {
        latency_ms: output.latency_ms,
        input_summary: output.input_summary,
        output_length: output.output.length,
      },
    });
  }
}

