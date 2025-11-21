'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ExternalLink, Calendar, User, Tag } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

interface BlackboardItem {
  id: string;
  type: string;
  summary: string;
  dimensions: Record<string, any>;
  links: {
    parents?: string[];
    children?: string[];
    related?: string[];
  };
  detail?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export default function BlackboardViewPage() {
  const router = useRouter();
  const [items, setItems] = useState<BlackboardItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<BlackboardItem | null>(null);
  const [relatedItems, setRelatedItems] = useState<BlackboardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRelated, setLoadingRelated] = useState(false);

  useEffect(() => {
    fetchAllItems();
  }, []);

  useEffect(() => {
    if (selectedItem) {
      fetchRelatedItems(selectedItem);
    }
  }, [selectedItem]);

  const fetchAllItems = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/blackboard?limit=1000&order_by=created_at&order_direction=desc');
      const data = await response.json();
      setItems(data.items || []);
    } catch (error) {
      console.error('Error fetching blackboard items:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRelatedItems = async (item: BlackboardItem) => {
    try {
      setLoadingRelated(true);
      const allRelatedIds = [
        ...(item.links?.parents || []),
        ...(item.links?.children || []),
        ...(item.links?.related || []),
      ];

      if (allRelatedIds.length === 0) {
        setRelatedItems([]);
        return;
      }

      const relatedPromises = allRelatedIds.map(id => 
        fetch(`/api/blackboard/${id}`)
          .then(r => r.ok ? r.json() : null)
          .catch(() => null)
      );
      
      const related = await Promise.all(relatedPromises);
      setRelatedItems(related.filter(Boolean));
    } catch (error) {
      console.error('Error fetching related items:', error);
      setRelatedItems([]);
    } finally {
      setLoadingRelated(false);
    }
  };

  const handleItemClick = async (itemId: string) => {
    try {
      const response = await fetch(`/api/blackboard/${itemId}`);
      if (response.ok) {
        const item = await response.json();
        setSelectedItem(item);
      }
    } catch (error) {
      console.error('Error fetching item:', error);
    }
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'user_request': 'bg-blue-500/20 text-blue-600 border-blue-500/50',
      'goal': 'bg-purple-500/20 text-purple-600 border-purple-500/50',
      'task': 'bg-green-500/20 text-green-600 border-green-500/50',
      'agent_output': 'bg-yellow-500/20 text-yellow-600 border-yellow-500/50',
      'judgement': 'bg-orange-500/20 text-orange-600 border-orange-500/50',
      'user_query_request': 'bg-cyan-500/20 text-cyan-600 border-cyan-500/50',
      'user_response': 'bg-teal-500/20 text-teal-600 border-teal-500/50',
    };
    return colors[type] || 'bg-gray-500/20 text-gray-600 border-gray-500/50';
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleString();
  };

  // Check if a string looks like a UUID
  const isUUID = (str: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  };

  // Check if a dimension key suggests it's an ID reference
  const isIdKey = (key: string): boolean => {
    return key.endsWith('_id') || key === 'id' || key.endsWith('_ids');
  };

  // Render a dimension value, making IDs clickable
  const renderDimensionValue = (key: string, value: any): React.ReactNode => {
    const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
    
    // If it's an ID key and the value is a UUID, make it clickable
    if (isIdKey(key) && typeof value === 'string' && isUUID(value)) {
      return (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleItemClick(value);
          }}
          className="text-primary hover:underline font-medium cursor-pointer"
        >
          {valueStr}
        </button>
      );
    }
    
    // If value is an array of UUIDs, make each clickable
    if (Array.isArray(value)) {
      return (
        <div className="flex flex-wrap gap-1">
          {value.map((item, idx) => {
            const itemStr = String(item);
            if (isUUID(itemStr)) {
              return (
                <button
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleItemClick(itemStr);
                  }}
                  className="text-primary hover:underline font-medium cursor-pointer text-xs"
                >
                  {itemStr.substring(0, 8)}...
                </button>
              );
            }
            return <span key={idx} className="text-xs">{itemStr}</span>;
          })}
        </div>
      );
    }
    
    // If it's a string that contains UUIDs, try to extract and make them clickable
    if (typeof value === 'string' && value.length > 30) {
      const uuidMatches = value.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi);
      if (uuidMatches && uuidMatches.length > 0) {
        let result: React.ReactNode[] = [];
        let lastIndex = 0;
        
        uuidMatches.forEach((uuid, idx) => {
          const uuidIndex = value.indexOf(uuid, lastIndex);
          if (uuidIndex > lastIndex) {
            result.push(<span key={`text-${idx}`}>{value.substring(lastIndex, uuidIndex)}</span>);
          }
          result.push(
            <button
              key={`uuid-${idx}`}
              onClick={(e) => {
                e.stopPropagation();
                handleItemClick(uuid);
              }}
              className="text-primary hover:underline font-medium cursor-pointer"
            >
              {uuid}
            </button>
          );
          lastIndex = uuidIndex + uuid.length;
        });
        
        if (lastIndex < value.length) {
          result.push(<span key="text-end">{value.substring(lastIndex)}</span>);
        }
        
        return <span>{result}</span>;
      }
    }
    
    return <span>{valueStr}</span>;
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-muted-foreground text-center py-12">Loading blackboard...</div>
      </div>
    );
  }

  if (selectedItem) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <Button
          variant="outline"
          onClick={() => setSelectedItem(null)}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Blackboard
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className={getTypeColor(selectedItem.type)}>
                    {selectedItem.type}
                  </Badge>
                  <button
                    onClick={() => handleItemClick(selectedItem.id)}
                    className="text-sm text-primary hover:underline font-medium cursor-pointer"
                    title="Click to view this item"
                  >
                    {selectedItem.id.substring(0, 8)}...
                  </button>
                </div>
                <CardTitle className="text-2xl mb-2">{selectedItem.summary}</CardTitle>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Created: {formatDate(selectedItem.created_at)}
                  </div>
                  {selectedItem.updated_at && (
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      Updated: {formatDate(selectedItem.updated_at)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Dimensions */}
            {selectedItem.dimensions && Object.keys(selectedItem.dimensions).length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Tag className="h-5 w-5" />
                  Dimensions
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {Object.entries(selectedItem.dimensions).map(([key, value]) => (
                    <div key={key} className="bg-muted p-3 rounded-md">
                      <div className="text-xs text-muted-foreground uppercase mb-1">{key}</div>
                      <div className="text-sm font-medium text-foreground break-words">
                        {renderDimensionValue(key, value)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Detail Content */}
            {selectedItem.detail && (
              <div>
                <h3 className="text-lg font-semibold mb-3">Details</h3>
                <div className="prose prose-invert dark:prose-invert max-w-none bg-muted p-4 rounded-md">
                  {selectedItem.detail.content ? (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeRaw]}
                      components={{
                        p: ({ children }: any) => <p className="my-2 text-foreground">{children}</p>,
                        code: ({ inline, children }: any) => (
                          <code className={inline ? 'bg-muted px-1.5 py-0.5 rounded text-sm' : 'block bg-muted p-4 rounded-md overflow-x-auto text-sm'}>
                            {children}
                          </code>
                        ),
                        a: ({ href, children }: any) => (
                          <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                            {children}
                          </a>
                        ),
                        br: () => <br />,
                      }}
                    >
                      {String(selectedItem.detail.content)}
                    </ReactMarkdown>
                  ) : (
                    <pre className="text-sm text-foreground whitespace-pre-wrap">
                      {JSON.stringify(selectedItem.detail, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            )}

            {/* Links */}
            {((selectedItem.links?.parents?.length || 0) + (selectedItem.links?.children?.length || 0) + (selectedItem.links?.related?.length || 0) > 0) && (
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <ExternalLink className="h-5 w-5" />
                  Related Items
                </h3>
                {loadingRelated ? (
                  <div className="text-muted-foreground">Loading related items...</div>
                ) : (
                  <div className="space-y-4">
                    {selectedItem.links?.parents && selectedItem.links.parents.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-muted-foreground mb-2">Parents</h4>
                        <div className="space-y-2">
                          {relatedItems
                            .filter(item => selectedItem.links?.parents?.includes(item.id))
                            .map(item => (
                              <Card
                                key={item.id}
                                className="cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => handleItemClick(item.id)}
                              >
                                <CardContent className="p-3">
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                      <Badge className={getTypeColor(item.type)} variant="outline">
                                        {item.type}
                                      </Badge>
                                      <p className="text-sm font-medium mt-1">{item.summary}</p>
                                    </div>
                                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                        </div>
                      </div>
                    )}

                    {selectedItem.links?.children && selectedItem.links.children.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-muted-foreground mb-2">Children</h4>
                        <div className="space-y-2">
                          {relatedItems
                            .filter(item => selectedItem.links?.children?.includes(item.id))
                            .map(item => (
                              <Card
                                key={item.id}
                                className="cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => handleItemClick(item.id)}
                              >
                                <CardContent className="p-3">
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                      <Badge className={getTypeColor(item.type)} variant="outline">
                                        {item.type}
                                      </Badge>
                                      <p className="text-sm font-medium mt-1">{item.summary}</p>
                                    </div>
                                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                        </div>
                      </div>
                    )}

                    {selectedItem.links?.related && selectedItem.links.related.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-muted-foreground mb-2">Related</h4>
                        <div className="space-y-2">
                          {relatedItems
                            .filter(item => selectedItem.links?.related?.includes(item.id))
                            .map(item => (
                              <Card
                                key={item.id}
                                className="cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => handleItemClick(item.id)}
                              >
                                <CardContent className="p-3">
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                      <Badge className={getTypeColor(item.type)} variant="outline">
                                        {item.type}
                                      </Badge>
                                      <p className="text-sm font-medium mt-1">{item.summary}</p>
                                    </div>
                                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main blackboard view - wiki-like interface
  const groupedByType = items.reduce((acc, item) => {
    if (!acc[item.type]) {
      acc[item.type] = [];
    }
    acc[item.type].push(item);
    return acc;
  }, {} as Record<string, BlackboardItem[]>);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">Blackboard</h1>
        <p className="text-muted-foreground">
          The shared knowledge base visible to all agents. Click any item to explore its details and relationships.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {Object.entries(groupedByType).map(([type, typeItems]) => (
          <Card key={type} className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Badge className={getTypeColor(type)}>
                    {type}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    ({typeItems.length})
                  </span>
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
              {typeItems.map((item) => (
                <Card
                  key={item.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors border-border"
                  onClick={() => handleItemClick(item.id)}
                >
                  <CardContent className="p-3">
                    <p className="text-sm font-medium text-foreground line-clamp-2 mb-2">
                      {item.summary}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {formatDate(item.created_at)}
                    </div>
                    {item.dimensions && Object.keys(item.dimensions).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {Object.entries(item.dimensions).slice(0, 3).map(([key, value]) => {
                          const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
                          const displayValue = valueStr.length > 20 ? valueStr.substring(0, 20) + '...' : valueStr;
                          const isClickable = isIdKey(key) && typeof value === 'string' && isUUID(value);
                          
                          return (
                            <Badge 
                              key={key} 
                              variant="outline" 
                              className={`text-xs ${isClickable ? 'cursor-pointer hover:bg-primary/10' : ''}`}
                              onClick={isClickable ? (e) => {
                                e.stopPropagation();
                                handleItemClick(value);
                              } : undefined}
                            >
                              {key}: {isClickable ? (
                                <span className="text-primary font-medium">{displayValue}</span>
                              ) : (
                                displayValue
                              )}
                            </Badge>
                          );
                        })}
                        {Object.keys(item.dimensions).length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{Object.keys(item.dimensions).length - 3} more
                          </Badge>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      {items.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No items in the blackboard yet.</p>
            <p className="text-sm text-muted-foreground mt-2">
              Items will appear here as agents create goals, tasks, and outputs.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

