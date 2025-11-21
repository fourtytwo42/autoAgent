import { testConnection } from '@/src/config/database';
import { modelRegistry } from '@/src/models/registry';
import { agentRegistry } from '@/src/agents/registry';
import { jobQueue } from '@/src/jobs/queue';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  database: 'connected' | 'disconnected';
  models: {
    total: number;
    enabled: number;
    available: number;
  };
  agents: {
    total: number;
    enabled: number;
  };
  jobs: {
    pending: number;
    running: number;
    failed: number;
  };
  timestamp: Date;
}

export class HealthChecker {
  async checkHealth(): Promise<HealthStatus> {
    // Check database
    const dbConnected = await testConnection();

    // Check models
    const allModels = await modelRegistry.getAllModels();
    const enabledModels = await modelRegistry.getEnabledModels();
    // For available, we'd need to check each provider, but that's expensive
    // So we'll just count enabled for now
    const availableModels = enabledModels.length;

    // Check agents
    const allAgents = await agentRegistry.getAllAgents();
    const enabledAgents = await agentRegistry.getEnabledAgents();

    // Check jobs
    const pendingJobs = await jobQueue.getPendingJobs(100);
    const runningJobs = await jobQueue.getRunningJobs(100);
    const failedJobs = await jobQueue.getFailedJobs(100);

    // Determine overall status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (!dbConnected) {
      status = 'unhealthy';
    } else if (enabledModels.length === 0 || enabledAgents.length === 0) {
      status = 'degraded';
    }

    return {
      status,
      database: dbConnected ? 'connected' : 'disconnected',
      models: {
        total: allModels.length,
        enabled: enabledModels.length,
        available: availableModels,
      },
      agents: {
        total: allAgents.length,
        enabled: enabledAgents.length,
      },
      jobs: {
        pending: pendingJobs.length,
        running: runningJobs.length,
        failed: failedJobs.length,
      },
      timestamp: new Date(),
    };
  }
}

export const healthChecker = new HealthChecker();

