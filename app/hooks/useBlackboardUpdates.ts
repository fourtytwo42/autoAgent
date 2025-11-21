'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSSE } from './useSSE';

export interface BlackboardItem {
  id: string;
  type: string;
  summary: string;
  dimensions: Record<string, any>;
  links: Record<string, string[]>;
  detail?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export function useBlackboardUpdates(initialItems: BlackboardItem[] = []) {
  const [items, setItems] = useState<BlackboardItem[]>(initialItems);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Use useCallback to stabilize the message handler
  const handleMessage = useCallback((data: any) => {
    if (data.type === 'blackboard_update') {
      if (data.action === 'created') {
        setItems((prev) => [data.item, ...prev]);
      } else if (data.action === 'updated') {
        setItems((prev) =>
          prev.map((item) => (item.id === data.item.id ? data.item : item))
        );
      } else if (data.action === 'deleted') {
        setItems((prev) => prev.filter((item) => item.id !== data.itemId));
      }
      setLastUpdate(new Date());
    }
  }, []);

  const { isConnected } = useSSE('/api/stream?channel=blackboard', {
    onMessage: handleMessage,
  });

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/blackboard');
      const data = await response.json();
      setItems(data.items || []);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to refresh blackboard:', error);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    items,
    lastUpdate,
    isConnected,
    refresh,
  };
}

