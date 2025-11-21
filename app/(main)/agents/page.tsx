'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProposalView from '../../components/agents/ProposalView';
import Button from '../../components/ui/Button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface Agent {
  id: string;
  description: string;
  is_core: boolean;
  is_enabled: boolean;
  modalities: string[];
}

interface AgentStatus {
  agent_id: string;
  is_working: boolean;
  current_work: string | null;
  job_count: number;
}

export default function AgentsPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentStatus, setAgentStatus] = useState<Record<string, AgentStatus>>({});
  const [proposals, setProposals] = useState<any[]>([]);
  const [showProposals, setShowProposals] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAgents();
    fetchAgentStatus();
    const interval = setInterval(fetchAgentStatus, 3000); // Update every 3 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchAgents = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/agents');
      const data = await response.json();
      setAgents(data.agents || []);
    } catch (error) {
      console.error('Error fetching agents:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAgentStatus = async () => {
    try {
      const response = await fetch('/api/agents/status');
      const data = await response.json();
      const statusMap: Record<string, AgentStatus> = {};
      data.agentStatus.forEach((status: AgentStatus) => {
        statusMap[status.agent_id] = status;
      });
      setAgentStatus(statusMap);
    } catch (error) {
      console.error('Error fetching agent status:', error);
    }
  };

  const fetchProposals = async () => {
    try {
      const response = await fetch('/api/blackboard?type=agent_proposal');
      const data = await response.json();
      setProposals(data.items || []);
    } catch (error) {
      console.error('Error fetching proposals:', error);
    }
  };

  useEffect(() => {
    fetchAgents();
    fetchProposals();
  }, []);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)]">
      <div className="flex-1 p-6 overflow-y-auto flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-foreground">Agents</h1>
          <Button
            onClick={() => {
              setShowProposals(!showProposals);
              if (!showProposals) {
                fetchProposals();
              }
            }}
          >
            {showProposals ? 'Hide' : 'Show'} Proposals
          </Button>
        </div>

        {showProposals && (
          <div className="mb-6">
            <ProposalView proposals={proposals} />
          </div>
        )}
        {loading ? (
          <div className="text-muted-foreground text-center py-12">Loading agents...</div>
        ) : (
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Core</TableHead>
                    <TableHead>Enabled</TableHead>
                    <TableHead>Modalities</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agents.map((agent) => {
                    const status = agentStatus[agent.id];
                    const isWorking = status?.is_working || false;
                    const currentWork = status?.current_work || null;
                    
                    return (
                      <TableRow 
                        key={agent.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => router.push(`/agents/${agent.id}`)}
                      >
                        <TableCell>
                          <code className="text-sm text-foreground">{agent.id}</code>
                        </TableCell>
                        <TableCell className="text-foreground">{agent.description}</TableCell>
                        <TableCell>
                          {isWorking ? (
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                              <span className="text-sm text-muted-foreground max-w-[200px] truncate">
                                {currentWork || 'Working...'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">Idle</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {agent.is_core ? (
                            <Badge variant="default" className="bg-green-600">✓</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {agent.is_enabled ? (
                            <Badge variant="default" className="bg-green-600">✓</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2 flex-wrap">
                            {agent.modalities.map((mod) => (
                              <Badge key={mod} variant="outline">
                                {mod}
                              </Badge>
                            ))}
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
