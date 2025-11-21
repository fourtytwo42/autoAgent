'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Button from '../../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table';

interface AgentDetail {
  agent: {
    id: string;
    description: string;
    system_prompt: string;
    modalities: string[];
    interests: any;
    permissions: any;
    is_core: boolean;
    is_enabled: boolean;
  };
  metrics: {
    usage_count: number;
    avg_score: number | null;
    avg_latency_ms: number | null;
    last_used_at: string | null;
  };
  events: any[];
  outputs: any[];
  currentJobs: any[];
}

export default function AgentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params.id as string;
  
  const [detail, setDetail] = useState<AgentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    fetchAgentDetail();
  }, [agentId]);

  const fetchAgentDetail = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/agents/${agentId}`);
      if (response.ok) {
        const data = await response.json();
        setDetail(data);
        setSystemPrompt(data.agent.system_prompt);
        setDescription(data.agent.description);
      }
    } catch (error) {
      console.error('Error fetching agent detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const response = await fetch(`/api/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_prompt: systemPrompt,
          description: description,
        }),
      });
      if (response.ok) {
        setEditing(false);
        fetchAgentDetail();
        alert('Agent updated successfully');
      } else {
        alert('Failed to update agent');
      }
    } catch (error) {
      console.error('Error updating agent:', error);
      alert('Failed to update agent');
    }
  };

  if (loading) {
    return <div className="p-6">Loading agent details...</div>;
  }

  if (!detail) {
    return <div className="p-6">Agent not found</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{detail.agent.id}</h1>
          <p className="text-muted-foreground mt-1">{detail.agent.description}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.back()}>
            Back
          </Button>
          {editing ? (
            <>
              <Button variant="outline" onClick={() => {
                setEditing(false);
                setSystemPrompt(detail.agent.system_prompt);
                setDescription(detail.agent.description);
              }}>
                Cancel
              </Button>
              <Button onClick={handleSave}>Save</Button>
            </>
          ) : (
            <Button onClick={() => setEditing(true)}>Edit</Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Metrics */}
        <Card>
          <CardHeader>
            <CardTitle>Metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Usage Count</span>
              <span className="font-semibold">{detail.metrics.usage_count}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Avg Score</span>
              <span className="font-semibold">
                {detail.metrics.avg_score ? detail.metrics.avg_score.toFixed(2) : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Avg Latency</span>
              <span className="font-semibold">
                {detail.metrics.avg_latency_ms ? `${detail.metrics.avg_latency_ms}ms` : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last Used</span>
              <span className="font-semibold">
                {detail.metrics.last_used_at
                  ? new Date(detail.metrics.last_used_at).toLocaleString()
                  : 'Never'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Status */}
        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Core</span>
              <Badge variant={detail.agent.is_core ? 'default' : 'outline'}>
                {detail.agent.is_core ? 'Yes' : 'No'}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Enabled</span>
              <Badge variant={detail.agent.is_enabled ? 'default' : 'outline'}>
                {detail.agent.is_enabled ? 'Yes' : 'No'}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current Jobs</span>
              <Badge variant={detail.currentJobs.length > 0 ? 'default' : 'outline'}>
                {detail.currentJobs.length}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Modalities</span>
              <div className="flex gap-1">
                {detail.agent.modalities.map((mod) => (
                  <Badge key={mod} variant="outline">
                    {mod}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Prompt */}
      <Card>
        <CardHeader>
          <CardTitle>System Prompt</CardTitle>
        </CardHeader>
        <CardContent>
          {editing ? (
            <Textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={10}
              className="font-mono text-sm"
            />
          ) : (
            <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-md">
              {detail.agent.system_prompt}
            </pre>
          )}
        </CardContent>
      </Card>

      {/* Description */}
      <Card>
        <CardHeader>
          <CardTitle>Description</CardTitle>
        </CardHeader>
        <CardContent>
          {editing ? (
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          ) : (
            <p className="text-foreground">{detail.agent.description}</p>
          )}
        </CardContent>
      </Card>

      {/* Recent Outputs */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Outputs</CardTitle>
        </CardHeader>
        <CardContent>
          {detail.outputs.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Summary</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.outputs.slice(0, 10).map((output) => (
                  <TableRow key={output.id}>
                    <TableCell className="max-w-md truncate">
                      {output.summary || 'No summary'}
                    </TableCell>
                    <TableCell>
                      {new Date(output.created_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground">No outputs yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

