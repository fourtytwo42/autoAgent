'use client';

import { useState, useEffect } from 'react';
import { useBlackboardUpdates } from '../../hooks/useBlackboardUpdates';

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

  // Use real-time updates hook
  const { items, isConnected, refresh } = useBlackboardUpdates([]);

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
      // Items will be updated by the hook
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
    <div className="flex h-screen max-h-[calc(100vh-4rem)]">
      {/* Filters */}
      <div className="w-64 bg-gray-100 p-4 border-r">
        <h2 className="font-bold mb-4">Filters</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Type</label>
            <select
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value })}
              className="w-full border rounded px-2 py-1"
            >
              <option value="">All Types</option>
              <option value="user_request">User Request</option>
              <option value="goal">Goal</option>
              <option value="task">Task</option>
              <option value="agent_output">Agent Output</option>
              <option value="judgement">Judgement</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Search</label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="Search..."
              className="w-full border rounded px-2 py-1"
            />
          </div>
        </div>
      </div>

      {/* Item List */}
      <div className="flex-1 overflow-y-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Blackboard Explorer</h1>
        <div className="mb-2 text-sm text-gray-500">
          {isConnected ? '🟢 Live updates' : '🔴 Disconnected'} | {filteredItems.length} items
        </div>
        {loading ? (
          <div>Loading...</div>
        ) : filteredItems.length === 0 ? (
          <div className="text-gray-500">No items found</div>
        ) : (
          <div className="space-y-2">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className={`p-4 border rounded cursor-pointer hover:bg-gray-50 ${
                  selectedItem?.id === item.id ? 'bg-blue-50 border-blue-500' : ''
                }`}
              >
                <div className="font-semibold">{item.type}</div>
                <div className="text-sm text-gray-600">{item.summary}</div>
                <div className="text-xs text-gray-400 mt-1">
                  {new Date(item.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Panel */}
      {selectedItem && (
        <div className="w-96 bg-gray-50 p-4 border-l overflow-y-auto">
          <h2 className="font-bold mb-4">Details</h2>
          <div className="space-y-4">
            <div>
              <div className="text-sm font-medium text-gray-600">Type</div>
              <div>{selectedItem.type}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-600">Summary</div>
              <div>{selectedItem.summary}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-600">Dimensions</div>
              <pre className="text-xs bg-white p-2 rounded overflow-auto">
                {JSON.stringify(selectedItem.dimensions, null, 2)}
              </pre>
            </div>
            {selectedItem.detail && (
              <div>
                <div className="text-sm font-medium text-gray-600">Detail</div>
                <pre className="text-xs bg-white p-2 rounded overflow-auto">
                  {JSON.stringify(selectedItem.detail, null, 2)}
                </pre>
              </div>
            )}
            <div>
              <div className="text-sm font-medium text-gray-600">Created</div>
              <div>{new Date(selectedItem.created_at).toLocaleString()}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

