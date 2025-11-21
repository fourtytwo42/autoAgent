import { NextResponse } from 'next/server';
import { testConnection } from '@/src/config/database';

export async function GET() {
  try {
    const dbConnected = await testConnection();

    return NextResponse.json({
      status: 'ok',
      database: dbConnected ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

