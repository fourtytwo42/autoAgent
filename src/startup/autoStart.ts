import { jobScheduler } from '@/src/jobs/scheduler';

let initialized = false;

/**
 * Auto-start the job scheduler when the module is imported
 * This ensures the scheduler runs even if /api/init is never called
 */
export function autoStartScheduler(): void {
  if (initialized) {
    return;
  }

  // Only start if not already running
  if (!jobScheduler['isRunning']) {
    console.log('🚀 Auto-starting job scheduler...');
    jobScheduler.start(5000); // Poll every 5 seconds
    initialized = true;
  }
}

// Auto-start when this module is imported
autoStartScheduler();

