import { NextRequest, NextResponse } from 'next/server';
import { agentRegistry } from '@/src/agents/registry';
import { agentTypesRepository } from '@/src/db/repositories/agentTypes.repository';
import { agentMetricsRepository } from '@/src/db/repositories/agentMetrics.repository';
import { eventsRepository } from '@/src/db/repositories/events.repository';
import { blackboardService } from '@/src/blackboard/service';
import { jobQueue } from '@/src/jobs/queue';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const agent = await agentRegistry.getAgent(id);
    
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Get metrics
    const metrics = await agentMetricsRepository.findByAgentId(id);

    // Get recent events for this agent
    const events = await eventsRepository.findRecent({
      agent_id: id,
      limit: 50,
    });

    // Get recent agent outputs
    const outputs = await blackboardService.query({
      type: 'agent_output',
      dimensions: { agent_id: id },
      order_by: 'created_at',
      order_direction: 'desc',
      limit: 20,
    });

    // Get current running jobs for this agent
    const runningJobs = await jobQueue.getRunningJobs(100);
    const agentJobs = runningJobs.filter(
      (job) => job.payload && (job.payload as any).agent_id === id
    );

    return NextResponse.json({
      agent,
      metrics: metrics || {
        agent_id: id,
        usage_count: 0,
        avg_score: null,
        avg_latency_ms: null,
        last_used_at: null,
      },
      events,
      outputs,
      currentJobs: agentJobs.map((job) => ({
        id: job.id,
        status: job.status,
        payload: job.payload,
        created_at: job.created_at,
      })),
    });
  } catch (error) {
    console.error('Error fetching agent details:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { system_prompt, description, interests, permissions } = body;

    const updates: any = {};
    if (system_prompt !== undefined) updates.system_prompt = system_prompt;
    if (description !== undefined) updates.description = description;
    if (interests !== undefined) updates.interests = interests;
    if (permissions !== undefined) updates.permissions = permissions;

    const updated = await agentTypesRepository.update(id, updates);

    if (!updated) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, agent: updated });
  } catch (error) {
    console.error('Error updating agent:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

