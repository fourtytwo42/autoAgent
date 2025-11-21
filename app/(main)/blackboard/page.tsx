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
      <div className="w-64 bg-gray-800 p-6 border-r border-gray-700">
        <h2 className="font-bold mb-6 text-white text-lg">Filters</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-300">Type</label>
            <select
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value })}
              className="w-full border border-gray-600 rounded-lg px-4 py-2 bg-gray-700 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <label className="block text-sm font-medium mb-1 text-gray-300">Search</label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="Search..."
              className="w-full border border-gray-600 rounded-lg px-4 py-2 bg-gray-700 text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Item List */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">Blackboard Explorer</h1>
          <div className="mb-4 text-sm text-gray-400 flex items-center gap-2">
          <span className={`inline-block w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} ${isConnected ? 'animate-pulse' : ''}`}></span>
          <span>{isConnected ? 'Live updates' : 'Disconnected'}</span>
          <span>|</span>
          <span>{filteredItems.length} items</span>
          </div>
        </div>
        {loading ? (
          <div className="text-gray-400">Loading...</div>
        ) : filteredItems.length === 0 ? (
          <div className="text-gray-400">No items found</div>
        ) : (
          <div className="space-y-2">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className={`p-5 border rounded-lg cursor-pointer hover:bg-gray-700 hover:border-gray-500 transition-all ${
                  selectedItem?.id === item.id ? 'bg-gray-700 border-blue-500 shadow-lg' : 'border-gray-600'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="font-semibold text-gray-200 text-lg">{item.type}</div>
                  <span className="text-xs text-gray-500">
                    {new Date(item.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="text-sm text-gray-300 mb-2">{item.summary}</div>
                <div className="text-xs text-gray-500">
                  {new Date(item.created_at).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Panel */}
      {selectedItem && (
        <div className="w-96 bg-gray-800 p-6 border-l border-gray-700 overflow-y-auto">
          <h2 className="text-xl font-bold mb-6 text-white">Details</h2>
          <div className="space-y-6">
            <div>
              <div className="text-sm font-medium text-gray-400 mb-2">Type</div>
              <div className="text-gray-200 font-medium">{selectedItem.type}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-400 mb-2">Summary</div>
              <div className="text-gray-200">{selectedItem.summary}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-400 mb-2">Dimensions</div>
              <pre className="text-xs bg-gray-900 p-4 rounded-lg overflow-auto text-gray-300 border border-gray-700">
                {JSON.stringify(selectedItem.dimensions, null, 2)}
              </pre>
            </div>
            {selectedItem.detail && (
              <div>
                <div className="text-sm font-medium text-gray-400 mb-2">Detail</div>
                <pre className="text-xs bg-gray-900 p-4 rounded-lg overflow-auto text-gray-300 border border-gray-700">
                  {JSON.stringify(selectedItem.detail, null, 2)}
                </pre>
              </div>
            )}
            <div>
              <div className="text-sm font-medium text-gray-400 mb-2">Created</div>
              <div className="text-gray-200">{new Date(selectedItem.created_at).toLocaleString()}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

