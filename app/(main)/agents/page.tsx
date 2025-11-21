'use client';

import { useState, useEffect } from 'react';
import ProposalView from '../../components/agents/ProposalView';
import Button from '../../components/ui/Button';

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
    <div className="flex flex-col h-screen max-h-[calc(100vh-4rem)]">
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-white">Agents</h1>
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
          <div className="text-gray-400 text-center py-12">Loading agents...</div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-700">
            <table className="min-w-full border-collapse bg-gray-800">
              <thead>
                <tr className="bg-gray-700">
                  <th className="border-b border-gray-600 px-6 py-4 text-left text-gray-200 font-semibold">ID</th>
                  <th className="border-b border-gray-600 px-6 py-4 text-left text-gray-200 font-semibold">Description</th>
                  <th className="border-b border-gray-600 px-6 py-4 text-left text-gray-200 font-semibold">Core</th>
                  <th className="border-b border-gray-600 px-6 py-4 text-left text-gray-200 font-semibold">Enabled</th>
                  <th className="border-b border-gray-600 px-6 py-4 text-left text-gray-200 font-semibold">Modalities</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((agent) => (
                  <tr
                    key={agent.id}
                    onClick={() => setSelectedAgent(agent)}
                    className={`cursor-pointer hover:bg-gray-700 transition-colors ${
                      selectedAgent?.id === agent.id ? 'bg-gray-700' : ''
                    }`}
                  >
                    <td className="border-b border-gray-700 px-6 py-4 text-gray-200">{agent.id}</td>
                    <td className="border-b border-gray-700 px-6 py-4 text-gray-200">{agent.description}</td>
                    <td className="border-b border-gray-700 px-6 py-4 text-gray-200">
                      {agent.is_core ? <span className="text-green-400">✓</span> : ''}
                    </td>
                    <td className="border-b border-gray-700 px-6 py-4 text-gray-200">
                      {agent.is_enabled ? <span className="text-green-400">✓</span> : ''}
                    </td>
                    <td className="border-b border-gray-700 px-6 py-4 text-gray-200">
                      <div className="flex gap-2">
                        {agent.modalities.map((mod) => (
                          <span key={mod} className="px-2 py-1 bg-gray-600 rounded text-xs">
                            {mod}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {selectedAgent && (
        <div className="w-96 bg-gray-800 p-6 border-l border-gray-700">
          <h2 className="text-xl font-bold mb-6 text-white">Agent Details</h2>
          <div className="space-y-4">
            <div>
              <div className="text-sm font-medium text-gray-400 mb-1">ID</div>
              <div className="text-gray-200 font-mono text-sm">{selectedAgent.id}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-400 mb-1">Description</div>
              <div className="text-gray-200">{selectedAgent.description}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-400 mb-1">Core</div>
              <div className="text-gray-200">
                {selectedAgent.is_core ? (
                  <span className="text-green-400">Yes</span>
                ) : (
                  <span className="text-gray-500">No</span>
                )}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-400 mb-1">Enabled</div>
              <div className="text-gray-200">
                {selectedAgent.is_enabled ? (
                  <span className="text-green-400">Yes</span>
                ) : (
                  <span className="text-gray-500">No</span>
                )}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-400 mb-2">Modalities</div>
              <div className="flex flex-wrap gap-2">
                {selectedAgent.modalities.map((mod) => (
                  <span key={mod} className="px-3 py-1 bg-gray-700 rounded text-sm">
                    {mod}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

