'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  const [agentNames, setAgentNames] = useState<Record<string, string>>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);

  useEffect(() => {
    fetchAllItems();
    fetchAgentNames();
    
    // Poll for updates every 3 seconds
    const interval = setInterval(() => {
      // Save scroll position before update
      if (scrollContainerRef.current) {
        scrollPositionRef.current = scrollContainerRef.current.scrollTop;
      }
      fetchAllItems();
    }, 3000);
    
    return () => clearInterval(interval);
  }, []);

  // Restore scroll position after items update
  useEffect(() => {
    if (scrollContainerRef.current && scrollPositionRef.current > 0) {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = scrollPositionRef.current;
        }
      });
    }
  }, [items]);

  const fetchAgentNames = async () => {
    try {
      const response = await fetch('/api/agents');
      if (response.ok) {
        const data = await response.json();
        const namesMap: Record<string, string> = {};
        data.agents?.forEach((agent: any) => {
          namesMap[agent.id] = agent.id; // Use ID as name, or could use description
        });
        setAgentNames(namesMap);
      }
    } catch (error) {
      console.error('Error fetching agent names:', error);
    }
  };

  useEffect(() => {
    if (selectedItem) {
      fetchRelatedItems(selectedItem);
    }
  }, [selectedItem]);

  const fetchAllItems = async () => {
    try {
      // Only show loading on initial load
      if (items.length === 0) {
        setLoading(true);
      }
      const response = await fetch('/api/blackboard?limit=1000&order_by=created_at&order_direction=desc');
      const data = await response.json();
      const newItems = data.items || [];
      
      // Only update if items actually changed (by comparing IDs)
      const currentIds = new Set(items.map(item => item.id));
      const newIds = new Set(newItems.map((item: BlackboardItem) => item.id));
      const idsChanged = currentIds.size !== newIds.size || 
        Array.from(newIds).some(id => !currentIds.has(id));
      
      if (idsChanged || items.length === 0) {
        setItems(newItems);
      }
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

  // Check if a dimension key is a reference to another entity
  const isReferenceKey = (key: string): boolean => {
    return isIdKey(key) || 
           key === 'agent_id' || 
           key === 'model_name' || 
           key === 'model_provider' ||
           key === 'agent_name' ||
           key === 'provider';
  };

  // Handle navigation for agent IDs
  const handleAgentClick = (agentId: string) => {
    router.push(`/agents/${agentId}`);
  };

  // Handle navigation for model references
  const handleModelClick = async (modelName?: string, modelProvider?: string, modelId?: string) => {
    if (modelId && isUUID(modelId)) {
      // If we have a model_id UUID, try to find it in blackboard first
      handleItemClick(modelId);
    } else if (modelName || modelProvider) {
      // Search for model-related items in blackboard
      try {
        const queryParams = new URLSearchParams();
        if (modelName) queryParams.set('summary', modelName);
        if (modelProvider) queryParams.set('dimensions', JSON.stringify({ provider: modelProvider }));
        
        const response = await fetch(`/api/blackboard?${queryParams.toString()}`);
        const data = await response.json();
        
        // Also try to find in models API
        const modelsResponse = await fetch('/api/models');
        const modelsData = await modelsResponse.json();
        const matchingModel = modelsData.models?.find((m: any) => 
          (modelName && m.name === modelName) || 
          (modelProvider && m.provider === modelProvider)
        );
        
        if (matchingModel) {
          // Navigate to models page with filter or show model info
          router.push(`/models`);
        } else if (data.items && data.items.length > 0) {
          // Navigate to first matching blackboard item
          handleItemClick(data.items[0].id);
        } else {
          // Navigate to models page
          router.push(`/models`);
        }
      } catch (error) {
        console.error('Error searching for model:', error);
        router.push(`/models`);
      }
    }
  };

  // Handle navigation for dependency task numbers
  const handleDependencyTaskClick = async (taskNumber: number, goalId?: string) => {
    try {
      // Search for task with this task_number and goal_id
      const queryParams = new URLSearchParams();
      queryParams.set('type', 'task');
      if (goalId) {
        queryParams.set('parent_id', goalId);
      }
      
      const response = await fetch(`/api/blackboard?${queryParams.toString()}&limit=1000`);
      const data = await response.json();
      
      // Find task with matching task_number
      const matchingTask = data.items?.find((item: BlackboardItem) => 
        item.dimensions?.task_number === taskNumber
      );
      
      if (matchingTask) {
        handleItemClick(matchingTask.id);
      } else {
        // If not found, show a message or search more broadly
        console.warn(`Task ${taskNumber} not found for goal ${goalId}`);
      }
    } catch (error) {
      console.error('Error finding dependency task:', error);
    }
  };

  // Handle source click - could be an ID or reference
  const handleSourceClick = async (source: any) => {
    if (typeof source === 'string' && isUUID(source)) {
      // If source is a UUID, treat it as a blackboard item ID
      handleItemClick(source);
    } else if (typeof source === 'string') {
      // If source is a string (like 'taskplanner'), search for items with that source
      try {
        const response = await fetch(`/api/blackboard?limit=1000`);
        const data = await response.json();
        const matchingItems = data.items?.filter((item: BlackboardItem) => 
          item.dimensions?.source === source
        );
        if (matchingItems && matchingItems.length > 0) {
          // Show first matching item or could show a list
          handleItemClick(matchingItems[0].id);
        }
      } catch (error) {
        console.error('Error searching for source:', error);
      }
    }
  };

  // Render a dimension value, making IDs clickable
  const renderDimensionValue = (key: string, value: any): React.ReactNode => {
    const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
    
    // Handle agent_id - navigate to agent page
    if (key === 'agent_id' && typeof value === 'string') {
      return (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleAgentClick(value);
          }}
          className="text-primary hover:underline font-medium cursor-pointer"
        >
          {valueStr}
        </button>
      );
    }
    
    // Handle model_name - search for model
    if (key === 'model_name' && typeof value === 'string') {
      return (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleModelClick(value, undefined, undefined);
          }}
          className="text-primary hover:underline font-medium cursor-pointer"
        >
          {valueStr}
        </button>
      );
    }
    
    // Handle model_provider - search for model
    if ((key === 'model_provider' || key === 'provider') && typeof value === 'string') {
      return (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleModelClick(undefined, value, undefined);
          }}
          className="text-primary hover:underline font-medium cursor-pointer"
        >
          {valueStr}
        </button>
      );
    }
    
    // Handle source - could be an ID or reference
    if (key === 'source') {
      return (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleSourceClick(value);
          }}
          className="text-primary hover:underline font-medium cursor-pointer"
        >
          {valueStr}
        </button>
      );
    }
    
    // Handle dependency_task_numbers - array of task numbers
    if (key === 'dependency_task_numbers' && Array.isArray(value)) {
      const goalId = selectedItem?.links?.parents?.[0]; // Get goal ID from parent
      return (
        <div className="flex flex-wrap gap-1">
          {value.map((taskNum: number, idx: number) => (
            <button
              key={idx}
              onClick={(e) => {
                e.stopPropagation();
                handleDependencyTaskClick(taskNum, goalId);
              }}
              className="text-primary hover:underline font-medium cursor-pointer text-xs bg-primary/10 px-2 py-1 rounded"
            >
              Task {taskNum}
            </button>
          ))}
        </div>
      );
    }
    
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
                    (() => {
                      // Check if this is a TaskPlanner output (JSON with tasks array)
                      const content = String(selectedItem.detail.content);
                      let parsedTasks: any[] | null = null;
                      
                      try {
                        // Try to parse as JSON
                        const jsonMatch = content.match(/\{[\s\S]*"tasks"[\s\S]*\}/);
                        if (jsonMatch) {
                          const parsed = JSON.parse(jsonMatch[0]);
                          if (parsed.tasks && Array.isArray(parsed.tasks)) {
                            parsedTasks = parsed.tasks;
                          }
                        }
                      } catch (e) {
                        // Not JSON or parse failed, continue with markdown
                      }
                      
                      // If we found structured tasks, render them specially
                      if (parsedTasks && parsedTasks.length > 0 && selectedItem.dimensions?.agent_id === 'TaskPlanner') {
                        const goalId = selectedItem.links?.parents?.[0];
                        
                        // Component to render a task with assigned agents
                        const TaskCard = ({ task, taskNumber, goalId }: { task: any; taskNumber: number; goalId?: string }) => {
                          const [assignedAgents, setAssignedAgents] = useState<string[]>([]);
                          const [loadingAgents, setLoadingAgents] = useState(true);
                          
                          useEffect(() => {
                            const fetchTaskAgents = async () => {
                              try {
                                const taskQueryParams = new URLSearchParams();
                                taskQueryParams.set('type', 'task');
                                if (goalId) {
                                  taskQueryParams.set('parent_id', goalId);
                                }
                                const taskResponse = await fetch(`/api/blackboard?${taskQueryParams.toString()}&limit=1000`);
                                const taskData = await taskResponse.json();
                                const actualTask = taskData.items?.find((item: BlackboardItem) => 
                                  item.dimensions?.task_number === taskNumber
                                );
                                if (actualTask) {
                                  const agents = actualTask.dimensions?.assigned_agents || 
                                    (actualTask.dimensions?.assigned_agent ? [actualTask.dimensions.assigned_agent] : []);
                                  setAssignedAgents(agents);
                                }
                              } catch (e) {
                                console.error('Error fetching task for agents:', e);
                              } finally {
                                setLoadingAgents(false);
                              }
                            };
                            
                            fetchTaskAgents();
                          }, [taskNumber, goalId]);
                          
                          return (
                            <Card
                              className="cursor-pointer hover:bg-muted/50 transition-colors border-border"
                              onClick={async () => {
                                await handleDependencyTaskClick(taskNumber, goalId);
                              }}
                            >
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                                      <Badge className="bg-green-500/20 text-green-600 border-green-500/50">
                                        Task {taskNumber}
                                      </Badge>
                                      {task.priority && (
                                        <Badge variant="outline" className="text-xs">
                                          {task.priority}
                                        </Badge>
                                      )}
                                      {task.task_type && (
                                        <Badge variant="outline" className="text-xs">
                                          {task.task_type}
                                        </Badge>
                                      )}
                                      {loadingAgents ? (
                                        <Badge variant="outline" className="text-xs">
                                          Loading agents...
                                        </Badge>
                                      ) : assignedAgents.length > 0 ? (
                                        assignedAgents.map((agentId: string) => (
                                          <Badge
                                            key={agentId}
                                            variant="outline"
                                            className="text-xs cursor-pointer hover:bg-primary/10"
                                            onClick={async (e) => {
                                              e.stopPropagation();
                                              handleAgentClick(agentId);
                                            }}
                                          >
                                            {agentNames[agentId] || agentId}
                                          </Badge>
                                        ))
                                      ) : task.agent_count ? (
                                        <Badge variant="outline" className="text-xs">
                                          {task.agent_count} agent{task.agent_count !== 1 ? 's' : ''} (not assigned yet)
                                        </Badge>
                                      ) : null}
                                    </div>
                                    <p className="text-sm font-medium text-foreground mb-2">
                                      {task.summary || 'No summary'}
                                    </p>
                                          {task.dependencies && Array.isArray(task.dependencies) && task.dependencies.length > 0 && (
                                            <div className="flex items-center gap-2 mt-2">
                                              <span className="text-xs text-muted-foreground">Depends on:</span>
                                              <div className="flex flex-wrap gap-1">
                                                {task.dependencies.map((depNum: number, depIdx: number) => (
                                                  <button
                                                    key={depIdx}
                                                    onClick={async (e) => {
                                                      e.stopPropagation();
                                                      await handleDependencyTaskClick(depNum, goalId);
                                                    }}
                                                    className="text-xs text-primary hover:underline font-medium cursor-pointer bg-primary/10 px-2 py-0.5 rounded"
                                                  >
                                                    Task {depNum}
                                                  </button>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                        <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                      </div>
                                    </CardContent>
                                  </Card>
                                );
                              };
                              
                              return (
                                <div className="space-y-4">
                                  <div className="text-sm text-muted-foreground mb-4">
                                    TaskPlanner created {parsedTasks.length} task{parsedTasks.length !== 1 ? 's' : ''}:
                                  </div>
                                  <div className="space-y-3">
                                    {parsedTasks.map((task: any, idx: number) => {
                                      const taskNumber = task.number || idx + 1;
                                      return (
                                        <TaskCard
                                          key={idx}
                                          task={task}
                                          taskNumber={taskNumber}
                                          goalId={goalId}
                                        />
                                      );
                                    })}
                                  </div>
                            <div className="mt-4 pt-4 border-t border-border">
                              <details className="text-sm">
                                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                  View raw JSON output
                                </summary>
                                <pre className="mt-2 text-xs text-foreground whitespace-pre-wrap bg-background p-3 rounded overflow-x-auto">
                                  {JSON.stringify(parsedTasks, null, 2)}
                                </pre>
                              </details>
                            </div>
                          </div>
                        );
                      }
                      
                      // Default: render as markdown
                      return (
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
                          {content}
                        </ReactMarkdown>
                      );
                    })()
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

  // Organize items by flow: user_request → goal → tasks → agent_outputs → wespeaker
  const organizeByFlow = () => {
    // Get all user requests
    const userRequests = items.filter(item => item.type === 'user_request');
    
    // For each user request, find its goals
    const flowGroups: Array<{
      userRequest: BlackboardItem;
      goals: Array<{
        goal: BlackboardItem;
        tasksWithOutputs: Array<{
          task: BlackboardItem;
          outputs: BlackboardItem[];
        }>;
        wespeakerOutputs: BlackboardItem[];
      }>;
    }> = [];

    userRequests.forEach(userRequest => {
      // Find goals linked to this user request
      const goalIds = userRequest.links?.children || [];
      const goals = items.filter(item => 
        item.type === 'goal' && goalIds.includes(item.id)
      ).sort((a, b) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return aTime - bTime;
      });

      const goalGroups = goals.map(goal => {
        // Find tasks for this goal
        const taskIds = goal.links?.children || [];
        const tasks = items.filter(item =>
          item.type === 'task' && taskIds.includes(item.id)
        ).sort((a, b) => {
          const aNum = a.dimensions?.task_number || 999;
          const bNum = b.dimensions?.task_number || 999;
          return aNum - bNum;
        });

        // For each task, find its outputs (grouped under task)
        const tasksWithOutputs = tasks.map(task => {
          const taskOutputs = items.filter(item =>
            item.type === 'agent_output' &&
            item.links?.parents?.includes(task.id) &&
            item.dimensions?.agent_id !== 'WeSpeaker'
          ).sort((a, b) => {
            const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
            const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
            return aTime - bTime;
          });
          return { task, outputs: taskOutputs };
        });

        // Find WeSpeaker outputs for this goal (exclude initial "working on it" messages)
        // Only include WeSpeaker outputs that are final responses (have goal_id but no task_id)
        const wespeakerOutputs = items.filter(item =>
          item.type === 'agent_output' &&
          item.dimensions?.agent_id === 'WeSpeaker' &&
          (item.links?.parents?.includes(goal.id) || item.dimensions?.goal_id === goal.id) &&
          !item.dimensions?.task_id // Exclude task-specific WeSpeaker outputs
        ).sort((a, b) => {
          const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
          const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
          return aTime - bTime;
        });

        return { goal, tasksWithOutputs, wespeakerOutputs };
      });

      flowGroups.push({ userRequest, goals: goalGroups });
    });

    // Also include orphaned goals (goals without user requests)
    const allGoalIds = flowGroups.flatMap(g => g.goals.map(gg => gg.goal.id));
    const orphanedGoals = items.filter(item =>
      item.type === 'goal' && !allGoalIds.includes(item.id)
    ).map(goal => {
      const taskIds = goal.links?.children || [];
      const tasks = items.filter(item =>
        item.type === 'task' && taskIds.includes(item.id)
      );
      const tasksWithOutputs = tasks.map(task => {
        const taskOutputs = items.filter(item =>
          item.type === 'agent_output' &&
          item.links?.parents?.includes(task.id) &&
          item.dimensions?.agent_id !== 'WeSpeaker'
        );
        return { task, outputs: taskOutputs };
      });
      const wespeakerOutputs = items.filter(item =>
        item.type === 'agent_output' &&
        item.dimensions?.agent_id === 'WeSpeaker' &&
        (item.links?.parents?.includes(goal.id) || item.dimensions?.goal_id === goal.id) &&
        !item.dimensions?.task_id
      );
      return { goal, tasksWithOutputs, wespeakerOutputs };
    });

    if (orphanedGoals.length > 0) {
      flowGroups.push({
        userRequest: { id: 'orphaned', type: 'goal', summary: 'Orphaned Goals', dimensions: {}, links: {} } as BlackboardItem,
        goals: orphanedGoals,
      });
    }

    return flowGroups;
  };

  const flowGroups = organizeByFlow();

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">Blackboard</h1>
        <p className="text-muted-foreground">
          The shared knowledge base visible to all agents. Items are organized by flow: User Request → Goal → Tasks → Agent Outputs → WeSpeaker Response.
        </p>
      </div>

      <div className="space-y-8">
        {flowGroups.map((group, groupIdx) => (
          <div key={groupIdx} className="space-y-4">
            {/* User Request */}
            {group.userRequest.type === 'user_request' && (
              <Card className="border-l-4 border-l-blue-500">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Badge className={getTypeColor('user_request')}>User Request</Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(group.userRequest.created_at)}
                    </span>
                  </div>
                  <CardTitle className="mt-2">{group.userRequest.summary}</CardTitle>
                </CardHeader>
              </Card>
            )}

            {/* Goals and their flow */}
            {group.goals.map((goalGroup, goalIdx) => (
              <div key={goalIdx} className="ml-4 space-y-3 border-l-2 border-l-purple-500/30 pl-4">
                {/* Goal */}
                <Card className="border-l-4 border-l-purple-500">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Badge className={getTypeColor('goal')}>Goal</Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(goalGroup.goal.created_at)}
                      </span>
                      {goalGroup.goal.dimensions?.status && (
                        <Badge variant="outline" className="text-xs">
                          {goalGroup.goal.dimensions.status}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-2 prose prose-invert dark:prose-invert max-w-none prose-sm cursor-pointer hover:text-primary" onClick={() => handleItemClick(goalGroup.goal.id)}>
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeRaw]}
                        components={{
                          p: ({ children }: any) => <p className="my-1 text-foreground text-sm">{children}</p>,
                          code: ({ inline, children }: any) => (
                            <code className={inline ? 'bg-muted px-1.5 py-0.5 rounded text-xs' : 'block bg-muted p-2 rounded-md overflow-x-auto text-xs'}>
                              {children}
                            </code>
                          ),
                          a: ({ href, children }: any) => (
                            <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm">
                              {children}
                            </a>
                          ),
                          br: () => <br />,
                          div: ({ children }: any) => <div className="text-sm">{children}</div>,
                          span: ({ children }: any) => <span className="text-sm">{children}</span>,
                          strong: ({ children }: any) => <strong className="text-sm font-semibold">{children}</strong>,
                          em: ({ children }: any) => <em className="text-sm italic">{children}</em>,
                        }}
                      >
                        {goalGroup.goal.summary}
                      </ReactMarkdown>
                    </div>
                  </CardHeader>
                </Card>

                {/* Tasks with their outputs */}
                {goalGroup.tasksWithOutputs.length > 0 && (
                  <div className="ml-4 space-y-3 border-l-2 border-l-green-500/30 pl-4">
                    <h4 className="text-sm font-semibold text-muted-foreground mb-2">Tasks ({goalGroup.tasksWithOutputs.length})</h4>
                    {goalGroup.tasksWithOutputs.map(({ task, outputs }) => (
                      <div key={task.id} className="space-y-2">
                        <Card
                          className="border-l-4 border-l-green-500 cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => handleItemClick(task.id)}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge className={getTypeColor('task')} variant="outline">Task</Badge>
                                  {task.dimensions?.task_number && (
                                    <Badge variant="outline" className="text-xs">
                                      #{task.dimensions.task_number}
                                    </Badge>
                                  )}
                                  {task.dimensions?.status && (
                                    <Badge variant="outline" className="text-xs">
                                      {task.dimensions.status}
                                    </Badge>
                                  )}
                                  {task.dimensions?.priority && (
                                    <Badge variant="outline" className="text-xs">
                                      {task.dimensions.priority}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm font-medium text-foreground">{task.summary}</p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                  <Calendar className="h-3 w-3" />
                                  {formatDate(task.created_at)}
                                  {task.dimensions?.goal_id && (
                                    <>
                                      <span>•</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleItemClick(task.dimensions.goal_id);
                                        }}
                                        className="text-primary hover:underline"
                                      >
                                        Goal: {task.dimensions.goal_id.substring(0, 8)}...
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                              <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            </div>
                          </CardContent>
                        </Card>
                        
                        {/* Agent Outputs for this task */}
                        {outputs.length > 0 && (
                          <div className="ml-4 space-y-2 border-l-2 border-l-yellow-500/30 pl-4">
                            {outputs.map((output) => (
                              <Card
                                key={output.id}
                                className="border-l-4 border-l-yellow-500 cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => handleItemClick(output.id)}
                              >
                                <CardContent className="p-3">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <Badge className={getTypeColor('agent_output')} variant="outline">Output</Badge>
                                        {output.dimensions?.agent_id && (
                                          <Badge
                                            variant="outline"
                                            className="text-xs cursor-pointer hover:bg-primary/10"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleAgentClick(output.dimensions.agent_id);
                                            }}
                                          >
                                            {output.dimensions.agent_id}
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="prose prose-invert dark:prose-invert max-w-none prose-sm">
                                        <ReactMarkdown
                                          remarkPlugins={[remarkGfm]}
                                          rehypePlugins={[rehypeRaw]}
                                          components={{
                                            p: ({ children }: any) => <p className="my-1 text-foreground text-sm">{children}</p>,
                                            code: ({ inline, children }: any) => (
                                              <code className={inline ? 'bg-muted px-1.5 py-0.5 rounded text-xs' : 'block bg-muted p-2 rounded-md overflow-x-auto text-xs'}>
                                                {children}
                                              </code>
                                            ),
                                            a: ({ href, children }: any) => (
                                              <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm">
                                                {children}
                                              </a>
                                            ),
                                            br: () => <br />,
                                            div: ({ children }: any) => <div className="text-sm">{children}</div>,
                                            span: ({ children }: any) => <span className="text-sm">{children}</span>,
                                            strong: ({ children }: any) => <strong className="text-sm font-semibold">{children}</strong>,
                                            em: ({ children }: any) => <em className="text-sm italic">{children}</em>,
                                          }}
                                        >
                                          {output.summary}
                                        </ReactMarkdown>
                                      </div>
                                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                                        <Calendar className="h-3 w-3" />
                                        {formatDate(output.created_at)}
                                        {output.dimensions?.agent_id && (
                                          <>
                                            <span>•</span>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleAgentClick(output.dimensions.agent_id);
                                              }}
                                              className="text-primary hover:underline"
                                            >
                                              Worker: {output.dimensions.agent_id}
                                            </button>
                                          </>
                                        )}
                                        {output.dimensions?.status && (
                                          <>
                                            <span>•</span>
                                            <span>Status: {output.dimensions.status}</span>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                    <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* WeSpeaker Final Response (at bottom) */}
                {goalGroup.wespeakerOutputs.length > 0 && (
                  <div className="ml-4 space-y-2 border-l-2 border-l-cyan-500/30 pl-4">
                    <h4 className="text-sm font-semibold text-muted-foreground mb-2">WeSpeaker Response{goalGroup.wespeakerOutputs.length !== 1 ? 's' : ''} ({goalGroup.wespeakerOutputs.length})</h4>
                    {goalGroup.wespeakerOutputs.map((output) => (
                      <Card
                        key={output.id}
                        className="border-l-4 border-l-cyan-500 cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => handleItemClick(output.id)}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge className={getTypeColor('agent_output')} variant="outline">WeSpeaker</Badge>
                              </div>
                              <p className="text-sm font-medium text-foreground">{output.summary}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                                <Calendar className="h-3 w-3" />
                                {formatDate(output.created_at)}
                                {output.dimensions?.agent_id && (
                                  <>
                                    <span>•</span>
                                    <span>Agent: {output.dimensions.agent_id}</span>
                                  </>
                                )}
                                {output.dimensions?.goal_id && (
                                  <>
                                    <span>•</span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleItemClick(output.dimensions.goal_id);
                                      }}
                                      className="text-primary hover:underline"
                                    >
                                      Goal: {output.dimensions.goal_id.substring(0, 8)}...
                                    </button>
                                  </>
                                )}
                                {output.dimensions?.status && (
                                  <>
                                    <span>•</span>
                                    <span>Status: {output.dimensions.status}</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
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

