'use client';

import { useState, useEffect } from 'react';
import ProposalView from '../../components/agents/ProposalView';

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
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">Agents</h1>
          <button
            onClick={() => {
              setShowProposals(!showProposals);
              if (!showProposals) {
                fetchProposals();
              }
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            {showProposals ? 'Hide' : 'Show'} Proposals
          </button>
        </div>

        {showProposals && (
          <div className="mb-6">
            <ProposalView proposals={proposals} />
          </div>
        )}
        {loading ? (
          <div>Loading...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-4 py-2 text-left">ID</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">Description</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">Core</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">Enabled</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">Modalities</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((agent) => (
                  <tr
                    key={agent.id}
                    onClick={() => setSelectedAgent(agent)}
                    className={`cursor-pointer hover:bg-gray-50 ${
                      selectedAgent?.id === agent.id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <td className="border border-gray-300 px-4 py-2">{agent.id}</td>
                    <td className="border border-gray-300 px-4 py-2">{agent.description}</td>
                    <td className="border border-gray-300 px-4 py-2">
                      {agent.is_core ? '✓' : ''}
                    </td>
                    <td className="border border-gray-300 px-4 py-2">
                      {agent.is_enabled ? '✓' : ''}
                    </td>
                    <td className="border border-gray-300 px-4 py-2">
                      {agent.modalities.join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {selectedAgent && (
        <div className="w-96 bg-gray-50 p-4 border-l">
          <h2 className="font-bold mb-4">Agent Details</h2>
          <div className="space-y-2">
            <div>
              <div className="text-sm font-medium text-gray-600">ID</div>
              <div>{selectedAgent.id}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-600">Description</div>
              <div>{selectedAgent.description}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-600">Core</div>
              <div>{selectedAgent.is_core ? 'Yes' : 'No'}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-600">Enabled</div>
              <div>{selectedAgent.is_enabled ? 'Yes' : 'No'}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-600">Modalities</div>
              <div>{selectedAgent.modalities.join(', ')}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

