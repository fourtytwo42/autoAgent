'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Button from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Play, Trash2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface Task {
  id: string;
  summary: string;
  dimensions: {
    status?: string;
    priority?: string;
    assigned_agent?: string;
    source?: string;
  };
  links: {
    parents?: string[];
    children?: string[];
  };
  created_at: string;
  updated_at: string;
}


export default function TasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(() => {
      fetchTasks();
    }, 3000); // Update every 3 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchTasks = async () => {
    try {
      const response = await fetch('/api/blackboard?type=task&limit=1000');
      const data = await response.json();
      // Also check if there are any goals that might have tasks
      const allItems = data.items || [];
      
      // If no tasks, try to get goals and see if we can show what agents are working on
      if (allItems.length === 0) {
        const goalsResponse = await fetch('/api/blackboard?type=goal&limit=100');
        const goalsData = await goalsResponse.json();
        // For now, just show tasks - goals will be handled separately
      }
      
      setTasks(allItems);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };


  const handleStartTask = async (taskId: string) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}/start`, {
        method: 'POST',
      });
      if (response.ok) {
        alert('Task started successfully');
        fetchTasks();
      } else {
        const data = await response.json();
        alert(`Failed to start task: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error starting task:', error);
      alert('Failed to start task');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) {
      return;
    }

    setDeleting(taskId);
    try {
      const response = await fetch(`/api/blackboard/${taskId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setTasks(tasks.filter((t) => t.id !== taskId));
      } else {
        alert('Failed to delete task');
      }
    } catch (error) {
      console.error('Error deleting task:', error);
      alert('Failed to delete task');
    } finally {
      setDeleting(null);
    }
  };


  const getStatusBadge = (status?: string) => {
    if (!status) return <Badge variant="outline">Unknown</Badge>;
    
    switch (status.toLowerCase()) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-500/20 text-yellow-600">Pending</Badge>;
      case 'assigned':
        return <Badge variant="outline" className="bg-blue-500/20 text-blue-600">Assigned</Badge>;
      case 'working':
        return <Badge variant="outline" className="bg-purple-500/20 text-purple-600 animate-pulse">Working</Badge>;
      case 'running':
        return <Badge variant="outline" className="bg-purple-500/20 text-purple-600 animate-pulse">Working</Badge>;
      case 'completed':
        return <Badge variant="default" className="bg-green-600">Completed</Badge>;
      case 'failed':
        return <Badge variant="outline" className="bg-red-500/20 text-red-600">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority?: string) => {
    if (!priority) return null;
    
    switch (priority.toLowerCase()) {
      case 'high':
        return <Badge variant="outline" className="bg-red-500/20 text-red-600">High</Badge>;
      case 'medium':
        return <Badge variant="outline" className="bg-yellow-500/20 text-yellow-600">Medium</Badge>;
      case 'low':
        return <Badge variant="outline" className="bg-blue-500/20 text-blue-600">Low</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };


  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)]">
      <div className="flex-1 p-6 overflow-y-auto flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Tasks</h1>
            <p className="text-muted-foreground mt-1">
              {tasks.filter(t => showCompleted || t.dimensions?.status !== 'completed').length} active task{tasks.filter(t => showCompleted || t.dimensions?.status !== 'completed').length !== 1 ? 's' : ''}
              {!showCompleted && tasks.filter(t => t.dimensions?.status === 'completed').length > 0 && (
                <span className="ml-2">({tasks.filter(t => t.dimensions?.status === 'completed').length} completed hidden)</span>
              )}
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <div className="flex items-center gap-2">
              <Checkbox
                id="show-completed"
                checked={showCompleted}
                onCheckedChange={(checked) => setShowCompleted(checked === true)}
              />
              <Label htmlFor="show-completed" className="text-sm text-muted-foreground cursor-pointer">
                Show completed
              </Label>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-muted-foreground text-center py-12">Loading tasks...</div>
        ) : tasks.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center space-y-4">
              <p className="text-muted-foreground">No tasks found</p>
              <p className="text-sm text-muted-foreground">
                Tasks are created when TaskPlanner breaks down goals into actionable items.
                <br />
                Try creating a goal in the conversation to generate tasks.
              </p>
              <div className="mt-4">
                <Button
                  variant="outline"
                  onClick={async () => {
                    // Create a test task for demonstration
                    try {
                      // First get a goal to attach to
                      const goalsResponse = await fetch('/api/blackboard?type=goal&limit=1');
                      const goalsData = await goalsResponse.json();
                      const goalId = goalsData.items?.[0]?.id;
                      
                      if (!goalId) {
                        alert('No goals found. Please create a goal first by sending a message in the conversation.');
                        return;
                      }
                      
                      const response = await fetch('/api/blackboard', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          type: 'task',
                          summary: 'Test task - Click play to start',
                          dimensions: {
                            status: 'pending',
                            priority: 'medium',
                            source: 'manual',
                          },
                          links: {
                            parents: [goalId],
                          },
                        }),
                      });
                      
                      if (response.ok) {
                        alert('Test task created!');
                        fetchTasks();
                      } else {
                        alert('Failed to create test task');
                      }
                    } catch (error) {
                      console.error('Error creating test task:', error);
                      alert('Failed to create test task');
                    }
                  }}
                >
                  Create Test Task
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Summary</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Assigned Agent</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-[120px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks
                    .filter(task => showCompleted || task.dimensions?.status !== 'completed')
                    .map((task) => {
                    const assignedAgent = task.dimensions?.assigned_agent;
                    const status = task.dimensions?.status || 'pending';
                    const canStart = status === 'pending' || status === 'assigned';
                    
                    return (
                      <TableRow key={task.id}>
                        <TableCell className="max-w-md">
                          <div className="truncate text-foreground" title={task.summary}>
                            {task.summary}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(status)}</TableCell>
                        <TableCell>{getPriorityBadge(task.dimensions?.priority)}</TableCell>
                        <TableCell>
                          {assignedAgent ? (
                            <code className="text-sm text-foreground">{assignedAgent}</code>
                          ) : (
                            <span className="text-muted-foreground text-sm">Unassigned</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(task.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {canStart && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleStartTask(task.id)}
                                className="h-8 w-8 p-0"
                                title="Start task"
                              >
                                <Play className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteTask(task.id)}
                              disabled={deleting === task.id}
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                              title="Delete task"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

