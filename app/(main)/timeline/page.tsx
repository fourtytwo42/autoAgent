'use client';

import { useState, useEffect } from 'react';
import { useEvents } from '../../hooks/useEvents';

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
  const { events, isConnected } = useEvents(100);
  const [loading, setLoading] = useState(false);

  // Filter events client-side
  const filteredEvents = events.filter((event) => {
    if (filter.type && event.type !== filter.type) return false;
    if (filter.agent && event.agent_id !== filter.agent) return false;
    return true;
  });

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Event Timeline</h1>
      <div className="mb-4 space-x-4">
        <select
          value={filter.type}
          onChange={(e) => setFilter({ ...filter, type: e.target.value })}
          className="border rounded px-2 py-1"
        >
          <option value="">All Types</option>
          <option value="goal_created">Goal Created</option>
          <option value="task_created">Task Created</option>
          <option value="agent_run">Agent Run</option>
          <option value="judgement">Judgement</option>
        </select>
      </div>
      <div className="mb-4 text-sm text-gray-500">
        {isConnected ? '🟢 Live updates' : '🔴 Disconnected'} | {filteredEvents.length} events
      </div>
      {loading ? (
        <div>Loading...</div>
      ) : filteredEvents.length === 0 ? (
        <div className="text-gray-500">No events found</div>
      ) : (
        <div className="space-y-2">
          {filteredEvents.map((event) => (
            <div key={event.id} className="border rounded p-4 hover:bg-gray-50">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-semibold">{event.type}</div>
                  {event.agent_id && (
                    <div className="text-sm text-gray-600">Agent: {event.agent_id}</div>
                  )}
                  {event.model_id && (
                    <div className="text-sm text-gray-600">Model: {event.model_id}</div>
                  )}
                  {event.data && (
                    <div className="text-xs text-gray-500 mt-1">
                      {JSON.stringify(event.data)}
                    </div>
                  )}
                </div>
                <div className="text-xs text-gray-400">
                  {new Date(event.created_at).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

