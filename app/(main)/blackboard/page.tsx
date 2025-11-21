'use client';

import { useState, useEffect } from 'react';
import { useBlackboardUpdates } from '../../hooks/useBlackboardUpdates';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Button from '../../components/ui/Button';

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
    if (filters.type && filters.type !== 'all' && item.type !== filters.type) return false;
    if (filters.search && !item.summary.toLowerCase().includes(filters.search.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <div className="flex h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)]">
      {/* Filters */}
      <Card className="w-64 p-6 border-r rounded-none bg-card">
        <div className="flex justify-between items-center mb-6">
          <h2 className="font-bold text-foreground text-lg">Filters</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const typeToClear = filters.type && filters.type !== 'all' ? filters.type : null;
              const confirmMsg = typeToClear 
                ? `Are you sure you want to clear all ${typeToClear} items?`
                : 'Are you sure you want to clear ALL blackboard items?';
              
              if (confirm(confirmMsg)) {
                try {
                  const response = await fetch('/api/blackboard/clear', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(typeToClear ? { type: typeToClear } : {}),
                  });
                  if (response.ok) {
                    const data = await response.json();
                    alert(`Cleared ${data.deletedCount} items`);
                    fetchItems();
                  } else {
                    alert('Failed to clear items');
                  }
                } catch (error) {
                  console.error('Error clearing items:', error);
                  alert('Failed to clear items');
                }
              }
            }}
          >
            Clear {filters.type && filters.type !== 'all' ? filters.type : 'All'}
          </Button>
        </div>
        <div className="flex flex-col gap-4">
          <div>
            <Label htmlFor="type-filter" className="mb-1">Type</Label>
            <Select
              value={filters.type || 'all'}
              onValueChange={(value) => setFilters({ ...filters, type: value === 'all' ? '' : value })}
            >
              <SelectTrigger id="type-filter" className="h-9">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="user_request">User Request</SelectItem>
                <SelectItem value="goal">Goal</SelectItem>
                <SelectItem value="task">Task</SelectItem>
                <SelectItem value="agent_output">Agent Output</SelectItem>
                <SelectItem value="judgement">Judgement</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="search-filter" className="mb-1">Search</Label>
            <Input
              id="search-filter"
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="Search..."
              className="h-9"
            />
          </div>
        </div>
      </Card>

      {/* Item List */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">Blackboard Explorer</h1>
          <div className="mb-4 text-sm text-muted-foreground flex items-center gap-2">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
              }`}
            />
            <span>{isConnected ? 'Live updates' : 'Disconnected'}</span>
            <span>|</span>
            <span>{filteredItems.length} items</span>
          </div>
        </div>
        {loading ? (
          <div className="text-muted-foreground">Loading...</div>
        ) : filteredItems.length === 0 ? (
          <div className="text-muted-foreground">No items found</div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredItems.map((item) => (
              <Card
                key={item.id}
                className={`cursor-pointer transition-all ${
                  selectedItem?.id === item.id
                    ? 'border-primary border-2 bg-muted'
                    : 'border-border hover:border-muted-foreground hover:bg-muted/50'
                }`}
                onClick={() => setSelectedItem(item)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-2">
                    <div className="font-semibold text-foreground text-lg">{item.type}</div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(item.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground mb-2">{item.summary}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(item.created_at).toLocaleTimeString()}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Detail Panel */}
      {selectedItem && (
        <Card className="w-96 p-6 border-l rounded-none bg-card overflow-y-auto">
          <h2 className="text-xl font-bold mb-6 text-foreground">Details</h2>
          <div className="flex flex-col gap-6">
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-2">Type</div>
              <div className="text-foreground font-medium">{selectedItem.type}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-2">Summary</div>
              <div className="text-foreground">{selectedItem.summary}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-2">Dimensions</div>
              <pre className="text-xs bg-background p-4 rounded-lg overflow-auto text-muted-foreground border border-border m-0">
                {JSON.stringify(selectedItem.dimensions, null, 2)}
              </pre>
            </div>
            {selectedItem.detail && (
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-2">Detail</div>
                <pre className="text-xs bg-background p-4 rounded-lg overflow-auto text-muted-foreground border border-border m-0">
                  {JSON.stringify(selectedItem.detail, null, 2)}
                </pre>
              </div>
            )}
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-2">Created</div>
              <div className="text-foreground">
                {new Date(selectedItem.created_at).toLocaleString()}
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
