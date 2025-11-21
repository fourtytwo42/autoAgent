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
  const optionsRef = useRef(options);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  // Update options ref without causing re-renders
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    if (!url) {
      setIsConnected(false);
      return;
    }

    let mounted = true;
    const maxReconnectAttempts = 5;
    const reconnectDelay = 3000;

    const connect = () => {
      if (!mounted || !url) return;

      try {
        const eventSource = new EventSource(url);
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
          if (!mounted) {
            eventSource.close();
            return;
          }
          setIsConnected(true);
          setError(null);
          reconnectAttemptsRef.current = 0;
          optionsRef.current.onOpen?.();
        };

        eventSource.onmessage = (event) => {
          if (!mounted) return;
          try {
            const data = JSON.parse(event.data);
            optionsRef.current.onMessage?.(data);
          } catch (e) {
            // If not JSON, treat as plain text
            optionsRef.current.onMessage?.(event.data);
          }
        };

        eventSource.onerror = (err) => {
          if (!mounted) return;
          
          // Only set error if connection was previously established
          if (eventSource.readyState === EventSource.CLOSED) {
            setIsConnected(false);
            const error = new Error('SSE connection closed');
            setError(error);
            optionsRef.current.onError?.(error);

            // Attempt reconnection
            if (reconnectAttemptsRef.current < maxReconnectAttempts) {
              reconnectAttemptsRef.current++;
              reconnectTimeoutRef.current = setTimeout(() => {
                if (mounted) {
                  eventSource.close();
                  connect();
                }
              }, reconnectDelay);
            }
          }
        };
      } catch (err) {
        if (mounted) {
          setIsConnected(false);
          setError(err as Error);
        }
      }
    };

    connect();

    return () => {
      mounted = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setIsConnected(false);
      optionsRef.current.onClose?.();
    };
  }, [url]); // Only depend on url, not options

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

