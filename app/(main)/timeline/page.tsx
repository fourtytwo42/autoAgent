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
    if (filter.type && event.type !== filter.type) return false;
    if (filter.agent && event.agent_id !== filter.agent) return false;
    return true;
  });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">Event Timeline</h1>
        <p className="text-gray-400">Real-time system events and activity</p>
      </div>
      <div className="mb-6 flex gap-4">
        <select
          value={filter.type}
          onChange={(e) => setFilter({ ...filter, type: e.target.value })}
          className="border border-gray-600 rounded-lg px-4 py-2 bg-gray-700 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Types</option>
          <option value="goal_created">Goal Created</option>
          <option value="task_created">Task Created</option>
          <option value="agent_run">Agent Run</option>
          <option value="judgement">Judgement</option>
        </select>
      </div>
      <div className="mb-4 text-sm text-gray-400 flex items-center gap-2">
        <span className={`inline-block w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} ${isConnected ? 'animate-pulse' : ''}`}></span>
        <span>{isConnected ? 'Live updates' : 'Disconnected'}</span>
        <span>|</span>
        <span>{filteredEvents.length} events</span>
      </div>
      {loading ? (
        <div className="text-gray-400">Loading...</div>
      ) : filteredEvents.length === 0 ? (
        <div className="text-gray-400">No events found</div>
      ) : (
        <div className="space-y-3">
          {filteredEvents.map((event) => (
            <div key={event.id} className="border border-gray-600 rounded-lg p-5 hover:bg-gray-700 hover:border-gray-500 bg-gray-800 transition-all">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="font-semibold text-gray-200 text-lg mb-2">{event.type}</div>
                  <div className="space-y-1">
                    {event.agent_id && (
                      <div className="text-sm text-gray-400">
                        <span className="text-gray-500">Agent:</span> {event.agent_id}
                      </div>
                    )}
                    {event.model_id && (
                      <div className="text-sm text-gray-400">
                        <span className="text-gray-500">Model:</span> {event.model_id}
                      </div>
                    )}
                    {event.data && (
                      <div className="text-xs text-gray-500 mt-2 bg-gray-900 p-2 rounded border border-gray-700">
                        {JSON.stringify(event.data, null, 2)}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-xs text-gray-500 ml-4 whitespace-nowrap">
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

