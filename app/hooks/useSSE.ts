'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export interface SSEOptions {
  onMessage?: (data: any) => void;
  onError?: (error: Error) => void;
  onOpen?: () => void;
  onClose?: () => void;
}

export function useSSE(url: string | null, options: SSEOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const { onMessage, onError, onOpen, onClose } = options;

  useEffect(() => {
    if (!url) {
      return;
    }

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
      onOpen?.();
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage?.(data);
      } catch (e) {
        // If not JSON, treat as plain text
        onMessage?.(event.data);
      }
    };

    eventSource.onerror = (err) => {
      const error = new Error('SSE connection error');
      setError(error);
      setIsConnected(false);
      onError?.(error);
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
      setIsConnected(false);
      onClose?.();
    };
  }, [url, onMessage, onError, onOpen, onClose]);

  const close = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    }
  }, []);

  return {
    isConnected,
    error,
    close,
  };
}

