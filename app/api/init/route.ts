import { NextResponse } from 'next/server';
import { initialize } from '@/src/startup';

export async function POST() {
  try {
    await initialize();
    return NextResponse.json({ status: 'ok', message: 'Initialization complete' });
  } catch (error) {
    console.error('Error in initialization:', error);
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

