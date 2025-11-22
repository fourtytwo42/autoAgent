import { jobScheduler } from '@/src/jobs/scheduler';

let initialized = false;

/**
 * Check if we're in Next.js build phase
 */
function isBuildPhase(): boolean {
  return (
    process.env.NEXT_PHASE === 'phase-production-build' ||
    process.env.NEXT_PHASE === 'phase-development-build' ||
    process.env.NODE_ENV === 'production' && !process.env.VERCEL && typeof process.env.NEXT_PHASE !== 'undefined'
  );
}

/**
 * Auto-start the job scheduler when the module is imported
 * This ensures the scheduler runs even if /api/init is never called
 * Skips starting during Next.js build phase
 */
export function autoStartScheduler(): void {
  // Skip during build phase
  if (isBuildPhase()) {
    console.log('⏭️  Skipping job scheduler auto-start during build phase');
    return;
  }

  if (initialized) {
    return;
  }

  // Only start if not already running
  if (!jobScheduler['isRunning']) {
    try {
      console.log('🚀 Auto-starting job scheduler...');
      jobScheduler.start(5000); // Poll every 5 seconds
      initialized = true;
    } catch (error) {
      // Silently fail during build or if database is not available
      console.log('⏭️  Skipping job scheduler auto-start:', error instanceof Error ? error.message : 'Unknown error');
    }
  }
}

// Auto-start when this module is imported (only if not in build phase)
autoStartScheduler();

