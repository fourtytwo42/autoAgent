import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { agentRegistry } from '@/src/agents/registry';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const enabledOnly = searchParams.get('enabled') === 'true';
    const coreOnly = searchParams.get('core') === 'true';

    let agents;
    if (coreOnly) {
      agents = await agentRegistry.getCoreAgents();
    } else if (enabledOnly) {
      agents = await agentRegistry.getEnabledAgents();
    } else {
      agents = await agentRegistry.getAllAgents();
    }

    return NextResponse.json({ agents, count: agents.length });
  } catch (error) {
    console.error('Error in agents API:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

