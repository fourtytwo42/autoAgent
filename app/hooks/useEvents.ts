'use client';

import { useState, useEffect } from 'react';
import { useSSE } from './useSSE';

export interface Event {
  id: string;
  type: string;
  agent_id?: string;
  model_id?: string;
  blackboard_item_id?: string;
  created_at: string;
  data?: Record<string, any>;
}

export function useEvents(limit: number = 100) {
  const [events, setEvents] = useState<Event[]>([]);

  const { isConnected } = useSSE('/api/stream?channel=system_events', {
    onMessage: (data) => {
      if (data.type === 'event') {
        setEvents((prev) => [data.event, ...prev].slice(0, limit));
      }
    },
  });

  useEffect(() => {
    // Load initial events
    fetch('/api/events?limit=' + limit)
      .then((res) => res.json())
      .then((data) => {
        setEvents(data.events || []);
      })
      .catch((error) => {
        console.error('Failed to load events:', error);
      });
  }, [limit]);

  return {
    events,
    isConnected,
  };
}

