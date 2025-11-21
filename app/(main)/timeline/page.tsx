'use client';

import { useState, useEffect } from 'react';

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
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ type: '', agent: '' });

  useEffect(() => {
    fetchEvents();
  }, [filter]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      // Note: This endpoint would need to be created
      const response = await fetch('/api/events');
      const data = await response.json();
      setEvents(data.events || []);
    } catch (error) {
      console.error('Error fetching events:', error);
      // For now, show empty state
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

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
      {loading ? (
        <div>Loading...</div>
      ) : events.length === 0 ? (
        <div className="text-gray-500">No events found</div>
      ) : (
        <div className="space-y-2">
          {events.map((event) => (
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

