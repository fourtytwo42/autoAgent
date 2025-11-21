'use client';

import { useState, useEffect } from 'react';
import { useEvents } from '../../hooks/useEvents';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Event {
  id: string;
  type: string;
  agent_id?: string;
  model_id?: string;
  blackboard_item_id?: string;
  created_at: string;
  data?: Record<string, any>;
}

export default function TimelinePage() {
  const [filter, setFilter] = useState({ type: '', agent: '' });
  const { events, isConnected: sseConnected } = useEvents(100);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);

  // Debounce connection status to prevent flickering
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsConnected(sseConnected);
    }, 200);
    return () => clearTimeout(timer);
  }, [sseConnected]);

  // Filter events client-side
  const filteredEvents = events.filter((event) => {
    if (filter.type && filter.type !== 'all' && event.type !== filter.type) return false;
    if (filter.agent && event.agent_id !== filter.agent) return false;
    return true;
  });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">Event Timeline</h1>
        <p className="text-muted-foreground">Real-time system events and activity</p>
      </div>
      <div className="mb-6 flex gap-4">
        <Select
          value={filter.type || 'all'}
          onValueChange={(value) => setFilter({ ...filter, type: value === 'all' ? '' : value })}
        >
          <SelectTrigger className="min-w-[200px]">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="goal_created">Goal Created</SelectItem>
            <SelectItem value="task_created">Task Created</SelectItem>
            <SelectItem value="agent_run">Agent Run</SelectItem>
            <SelectItem value="judgement">Judgement</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="mb-4 text-sm text-muted-foreground flex items-center gap-2">
        <span
          className={`inline-block w-2 h-2 rounded-full ${
            isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
          }`}
        />
        <span>{isConnected ? 'Live updates' : 'Disconnected'}</span>
        <span>|</span>
        <span>{filteredEvents.length} events</span>
      </div>
      {loading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : filteredEvents.length === 0 ? (
        <div className="text-muted-foreground">No events found</div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredEvents.map((event) => (
            <Card
              key={event.id}
              className="border-border hover:border-muted-foreground hover:bg-muted/50 transition-all"
            >
              <CardContent className="p-5">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="font-semibold text-foreground text-lg mb-2">{event.type}</div>
                    <div className="flex flex-col gap-1">
                      {event.agent_id && (
                        <div className="text-sm text-muted-foreground">
                          <span className="text-muted-foreground/70">Agent:</span> {event.agent_id}
                        </div>
                      )}
                      {event.model_id && (
                        <div className="text-sm text-muted-foreground">
                          <span className="text-muted-foreground/70">Model:</span> {event.model_id}
                        </div>
                      )}
                      {event.data && (
                        <div className="text-xs text-muted-foreground mt-2 bg-background p-2 rounded border border-border">
                          <pre className="m-0 whitespace-pre-wrap break-words">
                            {JSON.stringify(event.data, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground ml-4 whitespace-nowrap">
                    {new Date(event.created_at).toLocaleString()}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
