'use client';

interface Proposal {
  id: string;
  summary: string;
  dimensions: Record<string, any>;
  detail?: {
    proposed_agent?: any;
    reasoning?: string;
    votes?: Array<{
      judge_id: string;
      vote: 'approve' | 'reject';
      reasoning: string;
      score: number;
    }>;
  };
  created_at: string;
}

interface ProposalViewProps {
  proposals: Proposal[];
}

export default function ProposalView({ proposals }: ProposalViewProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Agent Proposals</h2>
      {proposals.length === 0 ? (
        <div className="text-gray-500">No proposals</div>
      ) : (
        <div className="space-y-4">
          {proposals.map((proposal) => {
            const status = proposal.dimensions?.status || 'pending';
            const votes = proposal.detail?.votes || [];
            const approveCount = votes.filter((v: any) => v.vote === 'approve').length;
            const rejectCount = votes.filter((v: any) => v.vote === 'reject').length;
            const avgScore = votes.length > 0
              ? votes.reduce((sum: number, v: any) => sum + v.score, 0) / votes.length
              : 0;

            return (
              <div key={proposal.id} className="border rounded p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-semibold">{proposal.summary}</div>
                    <div className="text-sm text-gray-600">
                      Proposed by: {proposal.dimensions?.proposed_by || 'Unknown'}
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs ${getStatusColor(status)}`}>
                    {status}
                  </span>
                </div>

                {proposal.detail?.reasoning && (
                  <div className="mb-2">
                    <div className="text-sm font-medium">Reasoning:</div>
                    <div className="text-sm text-gray-700">{proposal.detail.reasoning}</div>
                  </div>
                )}

                {votes.length > 0 && (
                  <div className="mb-2">
                    <div className="text-sm font-medium">Votes:</div>
                    <div className="text-sm text-gray-600">
                      Approve: {approveCount} | Reject: {rejectCount} | Avg Score: {(avgScore * 100).toFixed(1)}%
                    </div>
                    <details className="mt-1">
                      <summary className="text-xs cursor-pointer text-gray-500">
                        View vote details
                      </summary>
                      <div className="mt-1 space-y-1">
                        {votes.map((vote: any, index: number) => (
                          <div key={index} className="text-xs border rounded p-2 bg-gray-50">
                            <div className="font-medium">{vote.judge_id}: {vote.vote}</div>
                            <div className="text-gray-600">Score: {(vote.score * 100).toFixed(1)}%</div>
                            <div className="text-gray-500">{vote.reasoning}</div>
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                )}

                {proposal.detail?.proposed_agent && (
                  <details className="mt-2">
                    <summary className="text-sm cursor-pointer text-gray-600">
                      Proposed Agent Details
                    </summary>
                    <pre className="text-xs bg-gray-50 p-2 rounded mt-1 overflow-auto">
                      {JSON.stringify(proposal.detail.proposed_agent, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

