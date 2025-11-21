import { NextRequest, NextResponse } from 'next/server';
import { jobQueue } from '@/src/jobs/queue';
import { agentRegistry } from '@/src/agents/registry';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Get all running and pending jobs
    const runningJobs = await jobQueue.getRunningJobs(100);
    const pendingJobs = await jobQueue.getPendingJobs(100);
    const allActiveJobs = [...runningJobs, ...pendingJobs];
    
    // Get all agents
    const agents = await agentRegistry.getAllAgents();
    
    // Map agent status
    const agentStatus = agents.map((agent) => {
      const agentJobs = allActiveJobs.filter(
        (job) => job.payload && (job.payload as any).agent_id === agent.id
      );

      let currentWork = null;
      if (agentJobs.length > 0) {
        const job = agentJobs[0];
        const payload = job.payload as any;
        
        // Extract work description from job context
        if (payload.context?.task_summary) {
          currentWork = payload.context.task_summary.substring(0, 50);
        } else if (payload.context?.goal_id) {
          currentWork = 'Working on goal';
        } else if (payload.context?.message) {
          currentWork = payload.context.message.substring(0, 50);
        } else {
          currentWork = 'Processing...';
        }
      }

      const runningCount = agentJobs.filter(j => j.status === 'running').length;
      const pendingCount = agentJobs.filter(j => j.status === 'pending').length;
      
      return {
        agent_id: agent.id,
        is_working: runningCount > 0,
        is_pending: pendingCount > 0,
        current_work: currentWork,
        job_count: agentJobs.length,
        running_jobs: runningCount,
        pending_jobs: pendingCount,
      };
    });

    return NextResponse.json({ agentStatus });
  } catch (error) {
    console.error('Error fetching agent status:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

