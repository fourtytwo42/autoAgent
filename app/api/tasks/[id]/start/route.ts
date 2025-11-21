import { NextRequest, NextResponse } from 'next/server';
import { orchestrator } from '@/src/orchestrator/orchestrator';
import { blackboardService } from '@/src/blackboard/service';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Verify task exists
    const task = await blackboardService.findById(id);
    if (!task || task.type !== 'task') {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    // Process the task (this will assign an agent and create a job)
    await orchestrator.processTask(id);

    return NextResponse.json({ 
      success: true,
      message: 'Task started successfully'
    });
  } catch (error) {
    console.error('Error starting task:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

