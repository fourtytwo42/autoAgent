import { NextRequest, NextResponse } from 'next/server';
import { eventsRepository } from '@/src/db/repositories/events.repository';
import { EventType } from '@/src/types/events';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const typeParam = searchParams.get('type');
    const agentId = searchParams.get('agent_id');
    const limit = parseInt(searchParams.get('limit') || '100');

    const type: EventType | undefined = typeParam ? (typeParam as EventType) : undefined;

    const events = await eventsRepository.findRecent({
      type,
      agent_id: agentId || undefined,
      limit,
    });

    return NextResponse.json({ events });
  } catch (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}

