'use client';

import { useState, useEffect } from 'react';
import ProposalView from '../../components/agents/ProposalView';
import Button from '../../components/ui/Button';
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Card, Chip } from '@heroui/react';

interface Agent {
  id: string;
  description: string;
  is_core: boolean;
  is_enabled: boolean;
  modalities: string[];
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [proposals, setProposals] = useState<any[]>([]);
  const [showProposals, setShowProposals] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAgents();
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
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 4rem)',
      maxHeight: 'calc(100vh - 4rem)',
    }}>
      <div style={{
        flex: 1,
        padding: '24px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
        }}>
          <h1 style={{
            fontSize: '30px',
            fontWeight: 'bold',
            color: 'white',
          }}>Agents</h1>
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
          <div style={{ marginBottom: '24px' }}>
            <ProposalView proposals={proposals} />
          </div>
        )}
        {loading ? (
          <div style={{
            color: '#a1a1aa',
            textAlign: 'center',
            padding: '48px 0',
          }}>Loading agents...</div>
        ) : (
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <Table
              aria-label="Agents table"
              selectionMode="single"
              selectedKeys={selectedAgent ? [selectedAgent.id] : []}
              onSelectionChange={(keys) => {
                const selectedId = Array.from(keys)[0] as string;
                const agent = agents.find(a => a.id === selectedId);
                setSelectedAgent(agent || null);
              }}
            >
              <TableHeader>
                <TableColumn>ID</TableColumn>
                <TableColumn>Description</TableColumn>
                <TableColumn>Core</TableColumn>
                <TableColumn>Enabled</TableColumn>
                <TableColumn>Modalities</TableColumn>
              </TableHeader>
              <TableBody>
                {agents.map((agent) => (
                  <TableRow key={agent.id}>
                    <TableCell>
                      <code style={{
                        fontSize: '14px',
                        color: '#e4e4e7',
                      }}>{agent.id}</code>
                    </TableCell>
                    <TableCell style={{ color: '#e4e4e7' }}>{agent.description}</TableCell>
                    <TableCell>
                      {agent.is_core ? (
                        <Chip color="success" size="sm" variant="flat">✓</Chip>
                      ) : (
                        <span style={{ color: '#71717a' }}>—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {agent.is_enabled ? (
                        <Chip color="success" size="sm" variant="flat">✓</Chip>
                      ) : (
                        <span style={{ color: '#71717a' }}>—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {agent.modalities.map((mod) => (
                          <Chip key={mod} size="sm" variant="flat" color="default">
                            {mod}
                          </Chip>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
      {selectedAgent && (
        <Card style={{
          width: '384px',
          padding: '24px',
          borderLeft: '1px solid #3f3f46',
          backgroundColor: '#18181b',
        }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: 'bold',
            marginBottom: '24px',
            color: 'white',
          }}>Agent Details</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <div style={{
                fontSize: '14px',
                fontWeight: '500',
                color: '#a1a1aa',
                marginBottom: '4px',
              }}>ID</div>
              <div style={{
                color: '#e4e4e7',
                fontFamily: 'monospace',
                fontSize: '14px',
              }}>{selectedAgent.id}</div>
            </div>
            <div>
              <div style={{
                fontSize: '14px',
                fontWeight: '500',
                color: '#a1a1aa',
                marginBottom: '4px',
              }}>Description</div>
              <div style={{ color: '#e4e4e7' }}>{selectedAgent.description}</div>
            </div>
            <div>
              <div style={{
                fontSize: '14px',
                fontWeight: '500',
                color: '#a1a1aa',
                marginBottom: '4px',
              }}>Core</div>
              <div style={{ color: '#e4e4e7' }}>
                {selectedAgent.is_core ? (
                  <Chip color="success" size="sm" variant="flat">Yes</Chip>
                ) : (
                  <Chip size="sm" variant="flat">No</Chip>
                )}
              </div>
            </div>
            <div>
              <div style={{
                fontSize: '14px',
                fontWeight: '500',
                color: '#a1a1aa',
                marginBottom: '4px',
              }}>Enabled</div>
              <div style={{ color: '#e4e4e7' }}>
                {selectedAgent.is_enabled ? (
                  <Chip color="success" size="sm" variant="flat">Yes</Chip>
                ) : (
                  <Chip size="sm" variant="flat">No</Chip>
                )}
              </div>
            </div>
            <div>
              <div style={{
                fontSize: '14px',
                fontWeight: '500',
                color: '#a1a1aa',
                marginBottom: '8px',
              }}>Modalities</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {selectedAgent.modalities.map((mod) => (
                  <Chip key={mod} size="sm" variant="flat" color="default">
                    {mod}
                  </Chip>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
