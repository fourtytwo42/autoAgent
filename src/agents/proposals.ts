import { BlackboardItem } from '@/src/types/blackboard';
import { blackboardService } from '@/src/blackboard/service';
import { AgentType } from '@/src/types/agents';

export interface AgentProposal {
  id: string;
  proposed_agent: Partial<AgentType>;
  reasoning: string;
  proposed_by: string; // agent_id
  status: 'pending' | 'approved' | 'rejected';
  votes: Array<{
    judge_id: string;
    vote: 'approve' | 'reject';
    reasoning: string;
    score: number;
  }>;
  created_at: Date;
  updated_at: Date;
}

export class ProposalManager {
  async createProposal(
    proposedAgent: Partial<AgentType>,
    reasoning: string,
    proposedBy: string
  ): Promise<BlackboardItem> {
    const proposal = await blackboardService.create({
      type: 'agent_proposal',
      summary: `Proposal for new agent: ${proposedAgent.id || 'unnamed'}`,
      dimensions: {
        status: 'pending',
        proposed_by: proposedBy,
      },
      links: {},
      detail: {
        proposed_agent: proposedAgent,
        reasoning,
        votes: [],
      },
    });

    return proposal;
  }

  async addVote(
    proposalId: string,
    judgeId: string,
    vote: 'approve' | 'reject',
    reasoning: string,
    score: number
  ): Promise<boolean> {
    const proposal = await blackboardService.findById(proposalId);
    if (!proposal || proposal.type !== 'agent_proposal') {
      return false;
    }

    const votes = (proposal.detail?.votes as any[]) || [];
    
    // Check if judge already voted
    if (votes.some((v) => v.judge_id === judgeId)) {
      return false; // Already voted
    }

    votes.push({
      judge_id: judgeId,
      vote,
      reasoning,
      score,
    });

    // Update proposal
    await blackboardService.update(proposalId, {
      detail: {
        ...proposal.detail,
        votes,
      },
    });

    // Check if we have enough votes to decide
    await this.evaluateProposal(proposalId);

    return true;
  }

  async evaluateProposal(proposalId: string): Promise<'approved' | 'rejected' | 'pending'> {
    const proposal = await blackboardService.findById(proposalId);
    if (!proposal || proposal.type !== 'agent_proposal') {
      return 'pending';
    }

    const votes = (proposal.detail?.votes as any[]) || [];
    
    if (votes.length < 3) {
      // Need at least 3 judge votes
      return 'pending';
    }

    const approveVotes = votes.filter((v) => v.vote === 'approve').length;
    const rejectVotes = votes.filter((v) => v.vote === 'reject').length;
    const avgScore = votes.reduce((sum, v) => sum + v.score, 0) / votes.length;

    let status: 'approved' | 'rejected' | 'pending' = 'pending';

    if (approveVotes > rejectVotes && avgScore >= 0.7) {
      status = 'approved';
    } else if (rejectVotes > approveVotes || avgScore < 0.5) {
      status = 'rejected';
    }

    if (status !== 'pending') {
      await blackboardService.update(proposalId, {
        dimensions: {
          ...proposal.dimensions,
          status,
        },
      });
    }

    return status;
  }

  async getPendingProposals(): Promise<BlackboardItem[]> {
    return blackboardService.query({
      type: 'agent_proposal',
      dimensions: { status: 'pending' },
    });
  }

  async getApprovedProposals(): Promise<BlackboardItem[]> {
    return blackboardService.query({
      type: 'agent_proposal',
      dimensions: { status: 'approved' },
    });
  }
}

export const proposalManager = new ProposalManager();

