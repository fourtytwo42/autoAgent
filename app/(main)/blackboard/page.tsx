'use client';

import { useState, useEffect } from 'react';
import { useBlackboardUpdates } from '../../hooks/useBlackboardUpdates';
import { Card, Input, Select, SelectItem, Chip } from '@heroui/react';

interface BlackboardItem {
  id: string;
  type: string;
  summary: string;
  dimensions: Record<string, any>;
  links: Record<string, string[]>;
  detail?: Record<string, any>;
  created_at: string;
}

export default function BlackboardPage() {
  const [selectedItem, setSelectedItem] = useState<BlackboardItem | null>(null);
  const [filters, setFilters] = useState({
    type: '',
    search: '',
  });
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);

  // Use real-time updates hook
  const { items, isConnected: sseConnected, refresh } = useBlackboardUpdates([]);

  // Debounce connection status to prevent flickering
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsConnected(sseConnected);
    }, 200);
    return () => clearTimeout(timer);
  }, [sseConnected]);

  useEffect(() => {
    fetchItems();
  }, [filters]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.type) params.append('type', filters.type);
      if (filters.search) params.append('search', filters.search);

      const response = await fetch(`/api/blackboard?${params.toString()}`);
      const data = await response.json();
      refresh();
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter items client-side
  const filteredItems = items.filter((item) => {
    if (filters.type && item.type !== filters.type) return false;
    if (filters.search && !item.summary.toLowerCase().includes(filters.search.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <div style={{
      display: 'flex',
      height: 'calc(100vh - 4rem)',
      maxHeight: 'calc(100vh - 4rem)',
    }}>
      {/* Filters */}
      <Card style={{
        width: '256px',
        padding: '24px',
        borderRight: '1px solid #3f3f46',
        borderRadius: 0,
        backgroundColor: '#18181b',
      }}>
        <h2 style={{
          fontWeight: 'bold',
          marginBottom: '24px',
          color: 'white',
          fontSize: '18px',
        }}>Filters</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#d4d4d8',
              marginBottom: '4px',
            }}>Type</label>
            <Select
              selectedKeys={filters.type ? [filters.type] : []}
              onSelectionChange={(keys) => {
                const value = Array.from(keys)[0] as string || '';
                setFilters({ ...filters, type: value });
              }}
              placeholder="All Types"
              variant="bordered"
              size="sm"
            >
              <SelectItem key="user_request">User Request</SelectItem>
              <SelectItem key="goal">Goal</SelectItem>
              <SelectItem key="task">Task</SelectItem>
              <SelectItem key="agent_output">Agent Output</SelectItem>
              <SelectItem key="judgement">Judgement</SelectItem>
            </Select>
          </div>
          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#d4d4d8',
              marginBottom: '4px',
            }}>Search</label>
            <Input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="Search..."
              variant="bordered"
              size="sm"
            />
          </div>
        </div>
      </Card>

      {/* Item List */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '24px',
      }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{
            fontSize: '30px',
            fontWeight: 'bold',
            color: 'white',
            marginBottom: '8px',
          }}>Blackboard Explorer</h1>
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
            <span>{filteredItems.length} items</span>
          </div>
        </div>
        {loading ? (
          <div style={{ color: '#a1a1aa' }}>Loading...</div>
        ) : filteredItems.length === 0 ? (
          <div style={{ color: '#a1a1aa' }}>No items found</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredItems.map((item) => (
              <Card
                key={item.id}
                isPressable
                onPress={() => setSelectedItem(item)}
                style={{
                  padding: '20px',
                  border: selectedItem?.id === item.id ? '2px solid #3b82f6' : '1px solid #3f3f46',
                  backgroundColor: selectedItem?.id === item.id ? '#27272a' : '#18181b',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (selectedItem?.id !== item.id) {
                    e.currentTarget.style.borderColor = '#52525b';
                    e.currentTarget.style.backgroundColor = '#27272a';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedItem?.id !== item.id) {
                    e.currentTarget.style.borderColor = '#3f3f46';
                    e.currentTarget.style.backgroundColor = '#18181b';
                  }
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  marginBottom: '8px',
                }}>
                  <div style={{
                    fontWeight: '600',
                    color: 'white',
                    fontSize: '18px',
                  }}>{item.type}</div>
                  <span style={{
                    fontSize: '12px',
                    color: '#71717a',
                  }}>
                    {new Date(item.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div style={{
                  fontSize: '14px',
                  color: '#d4d4d8',
                  marginBottom: '8px',
                }}>{item.summary}</div>
                <div style={{
                  fontSize: '12px',
                  color: '#71717a',
                }}>
                  {new Date(item.created_at).toLocaleTimeString()}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Detail Panel */}
      {selectedItem && (
        <Card style={{
          width: '384px',
          padding: '24px',
          borderLeft: '1px solid #3f3f46',
          borderRadius: 0,
          backgroundColor: '#18181b',
          overflowY: 'auto',
        }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: 'bold',
            marginBottom: '24px',
            color: 'white',
          }}>Details</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
              <div style={{
                fontSize: '14px',
                fontWeight: '500',
                color: '#a1a1aa',
                marginBottom: '8px',
              }}>Type</div>
              <div style={{
                color: '#e4e4e7',
                fontWeight: '500',
              }}>{selectedItem.type}</div>
            </div>
            <div>
              <div style={{
                fontSize: '14px',
                fontWeight: '500',
                color: '#a1a1aa',
                marginBottom: '8px',
              }}>Summary</div>
              <div style={{ color: '#e4e4e7' }}>{selectedItem.summary}</div>
            </div>
            <div>
              <div style={{
                fontSize: '14px',
                fontWeight: '500',
                color: '#a1a1aa',
                marginBottom: '8px',
              }}>Dimensions</div>
              <pre style={{
                fontSize: '12px',
                backgroundColor: '#0a0a0a',
                padding: '16px',
                borderRadius: '8px',
                overflow: 'auto',
                color: '#d4d4d8',
                border: '1px solid #3f3f46',
                margin: 0,
              }}>
                {JSON.stringify(selectedItem.dimensions, null, 2)}
              </pre>
            </div>
            {selectedItem.detail && (
              <div>
                <div style={{
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#a1a1aa',
                  marginBottom: '8px',
                }}>Detail</div>
                <pre style={{
                  fontSize: '12px',
                  backgroundColor: '#0a0a0a',
                  padding: '16px',
                  borderRadius: '8px',
                  overflow: 'auto',
                  color: '#d4d4d8',
                  border: '1px solid #3f3f46',
                  margin: 0,
                }}>
                  {JSON.stringify(selectedItem.detail, null, 2)}
                </pre>
              </div>
            )}
            <div>
              <div style={{
                fontSize: '14px',
                fontWeight: '500',
                color: '#a1a1aa',
                marginBottom: '8px',
              }}>Created</div>
              <div style={{ color: '#e4e4e7' }}>
                {new Date(selectedItem.created_at).toLocaleString()}
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
