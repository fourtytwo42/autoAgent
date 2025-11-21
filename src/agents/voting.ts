import { proposalManager } from './proposals';
import { agentRegistry } from './registry';
import { agentTypesRepository } from '@/src/db/repositories/agentTypes.repository';

export interface Vote {
  judge_id: string;
  vote: 'approve' | 'reject';
  reasoning: string;
  score: number;
}

export class VotingSystem {
  async voteOnProposal(
    proposalId: string,
    judgeId: string,
    vote: 'approve' | 'reject',
    reasoning: string,
    score: number
  ): Promise<boolean> {
    return proposalManager.addVote(proposalId, judgeId, vote, reasoning, score);
  }

  async implementApprovedProposal(proposalId: string): Promise<boolean> {
    const proposal = await proposalManager.getApprovedProposals().then(
      proposals => proposals.find(p => p.id === proposalId)
    );

    if (!proposal) {
      return false;
    }

    const proposedAgent = proposal.detail?.proposed_agent as any;
    if (!proposedAgent || !proposedAgent.id) {
      return false;
    }

    // Check if agent already exists
    const existing = await agentRegistry.getAgent(proposedAgent.id);
    if (existing) {
      return false; // Already exists
    }

    // Create the agent
    await agentTypesRepository.create({
      id: proposedAgent.id,
      description: proposedAgent.description || '',
      system_prompt: proposedAgent.system_prompt || '',
      modalities: proposedAgent.modalities || ['text'],
      interests: proposedAgent.interests || {},
      permissions: proposedAgent.permissions || { can_use_tools: [], can_create_goals: false },
      is_core: proposedAgent.is_core || false,
      is_enabled: proposedAgent.is_enabled !== undefined ? proposedAgent.is_enabled : true,
    });

    // Mark proposal as implemented
    await proposalManager.evaluateProposal(proposalId);

    return true;
  }

  async getVoteSummary(proposalId: string): Promise<{
    total: number;
    approve: number;
    reject: number;
    averageScore: number;
  } | null> {
    const proposal = await proposalManager.getPendingProposals().then(
      proposals => proposals.find(p => p.id === proposalId)
    ) || await proposalManager.getApprovedProposals().then(
      proposals => proposals.find(p => p.id === proposalId)
    );

    if (!proposal) {
      return null;
    }

    const votes = (proposal.detail?.votes as Vote[]) || [];
    
    return {
      total: votes.length,
      approve: votes.filter(v => v.vote === 'approve').length,
      reject: votes.filter(v => v.vote === 'reject').length,
      averageScore: votes.length > 0
        ? votes.reduce((sum, v) => sum + v.score, 0) / votes.length
        : 0,
    };
  }
}

export const votingSystem = new VotingSystem();

