'use client';

import { useState, useEffect } from 'react';
import { useEvents } from '../../hooks/useEvents';
import { Card, Select, SelectItem, Chip } from '@heroui/react';

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
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{
          fontSize: '30px',
          fontWeight: 'bold',
          color: 'white',
          marginBottom: '8px',
        }}>Event Timeline</h1>
        <p style={{ color: '#a1a1aa' }}>Real-time system events and activity</p>
      </div>
      <div style={{
        marginBottom: '24px',
        display: 'flex',
        gap: '16px',
      }}>
        <Select
          selectedKeys={filter.type ? [filter.type] : []}
          onSelectionChange={(keys) => {
            const value = Array.from(keys)[0] as string || '';
            setFilter({ ...filter, type: value });
          }}
          placeholder="All Types"
          variant="bordered"
          style={{ minWidth: '200px' }}
        >
          <SelectItem key="goal_created">Goal Created</SelectItem>
          <SelectItem key="task_created">Task Created</SelectItem>
          <SelectItem key="agent_run">Agent Run</SelectItem>
          <SelectItem key="judgement">Judgement</SelectItem>
        </Select>
      </div>
      <div style={{
        marginBottom: '16px',
        fontSize: '14px',
        color: '#a1a1aa',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <span style={{
          display: 'inline-block',
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: isConnected ? '#22c55e' : '#ef4444',
          animation: isConnected ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'none',
        }}></span>
        <span>{isConnected ? 'Live updates' : 'Disconnected'}</span>
        <span>|</span>
        <span>{filteredEvents.length} events</span>
      </div>
      {loading ? (
        <div style={{ color: '#a1a1aa' }}>Loading...</div>
      ) : filteredEvents.length === 0 ? (
        <div style={{ color: '#a1a1aa' }}>No events found</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredEvents.map((event) => (
            <Card
              key={event.id}
              style={{
                padding: '20px',
                border: '1px solid #3f3f46',
                backgroundColor: '#18181b',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#52525b';
                e.currentTarget.style.backgroundColor = '#27272a';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#3f3f46';
                e.currentTarget.style.backgroundColor = '#18181b';
              }}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontWeight: '600',
                    color: 'white',
                    fontSize: '18px',
                    marginBottom: '8px',
                  }}>{event.type}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {event.agent_id && (
                      <div style={{
                        fontSize: '14px',
                        color: '#a1a1aa',
                      }}>
                        <span style={{ color: '#71717a' }}>Agent:</span> {event.agent_id}
                      </div>
                    )}
                    {event.model_id && (
                      <div style={{
                        fontSize: '14px',
                        color: '#a1a1aa',
                      }}>
                        <span style={{ color: '#71717a' }}>Model:</span> {event.model_id}
                      </div>
                    )}
                    {event.data && (
                      <div style={{
                        fontSize: '12px',
                        color: '#71717a',
                        marginTop: '8px',
                        backgroundColor: '#0a0a0a',
                        padding: '8px',
                        borderRadius: '4px',
                        border: '1px solid #3f3f46',
                      }}>
                        <pre style={{
                          margin: 0,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        }}>
                          {JSON.stringify(event.data, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
                <div style={{
                  fontSize: '12px',
                  color: '#71717a',
                  marginLeft: '16px',
                  whiteSpace: 'nowrap',
                }}>
                  {new Date(event.created_at).toLocaleString()}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
