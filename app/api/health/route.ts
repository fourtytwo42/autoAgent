import { NextResponse } from 'next/server';
import { healthChecker } from '@/src/health/checker';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const health = await healthChecker.checkHealth();

    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 200 : 503;

    return NextResponse.json(health, { status: statusCode });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}

