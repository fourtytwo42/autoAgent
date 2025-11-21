import { NextRequest, NextResponse } from 'next/server';
import { orchestrator } from '@/src/orchestrator/orchestrator';
import { blackboardService } from '@/src/blackboard/service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Fetch conversation history from blackboard
    // Get user requests and agent outputs, ordered by creation time
    const userRequests = await blackboardService.query({
      type: 'user_request',
      order_by: 'created_at',
      order_direction: 'asc',
      limit: 100,
    });

    // Only get WeSpeaker agent outputs for conversation (not TaskPlanner, Judge, etc.)
    const agentOutputs = await blackboardService.query({
      type: 'agent_output',
      dimensions: {
        agent_id: 'WeSpeaker',
      },
      order_by: 'created_at',
      order_direction: 'asc',
      limit: 100,
    });

    // Combine and sort all messages by timestamp
    const allItems = [...userRequests, ...agentOutputs].sort(
      (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
    );

    // Convert to message format
    const messages = allItems.map((item) => {
      let content = item.summary || '';
      
      // For agent outputs, get the actual content from detail.content
      if (item.type === 'agent_output' && item.detail && typeof item.detail === 'object') {
        const detail = item.detail as any;
        if (detail.content && typeof detail.content === 'string') {
          content = detail.content;
        }
      }
      
      return {
        id: item.id,
        role: item.type === 'user_request' ? 'user' : 'assistant',
        content: content,
        timestamp: new Date(item.created_at || Date.now()),
      };
    });

    return NextResponse.json({ messages });
  } catch (error) {
    console.error('Error fetching conversation history:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error', messages: [] },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, metadata } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required and must be a string' },
        { status: 400 }
      );
    }

    // Use streaming for better UX
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Process the request - no automated status message, just wait for WeSpeaker's response
          const response = await orchestrator.handleUserRequest({
            message,
            metadata,
          });

          // Send the final response from WeSpeaker
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'response', ...response })}\n\n`));
          controller.close();
        } catch (error) {
          console.error('Error in conversation stream:', error);
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'error', error: error instanceof Error ? error.message : 'Unknown error' })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error in conversation API:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

