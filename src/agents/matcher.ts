import { AgentType } from '@/src/types/agents';
import { BlackboardItem, BlackboardItemType } from '@/src/types/blackboard';

export interface MatchResult {
  agent: AgentType;
  score: number;
  reasons: string[];
}

export class InterestMatcher {
  match(agents: AgentType[], item: BlackboardItem): MatchResult[] {
    const results: MatchResult[] = [];

    for (const agent of agents) {
      if (!agent.is_enabled) continue;

      const match = this.scoreMatch(agent, item);
      if (match.score > 0) {
        results.push(match);
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return results;
  }

  private scoreMatch(agent: AgentType, item: BlackboardItem): MatchResult {
    let score = 0;
    const reasons: string[] = [];

    const interests = agent.interests || {};

    // Match by type
    if (interests.type) {
      const typeInterests = Array.isArray(interests.type) ? interests.type : [interests.type];
      if (typeInterests.includes(item.type)) {
        score += 10;
        reasons.push(`matches type: ${item.type}`);
      }
    }

    // Match by dimensions
    if (interests.dimensions) {
      const dimensionMatches = this.matchDimensions(interests.dimensions, item.dimensions);
      score += dimensionMatches.score;
      if (dimensionMatches.reasons.length > 0) {
        reasons.push(...dimensionMatches.reasons);
      }
    }

    // Match by topic (if in summary)
    if (interests.topic) {
      const topics = Array.isArray(interests.topic) ? interests.topic : [interests.topic];
      const summaryLower = item.summary.toLowerCase();
      for (const topic of topics) {
        if (summaryLower.includes(topic.toLowerCase())) {
          score += 5;
          reasons.push(`matches topic: ${topic}`);
        }
      }
    }

    // Match by status
    if (interests.status) {
      const statuses = Array.isArray(interests.status) ? interests.status : [interests.status];
      const itemStatus = item.dimensions?.status;
      if (itemStatus && statuses.includes(itemStatus)) {
        score += 3;
        reasons.push(`matches status: ${itemStatus}`);
      }
    }

    return {
      agent,
      score,
      reasons,
    };
  }

  private matchDimensions(interestDimensions: any, itemDimensions: Record<string, any>): {
    score: number;
    reasons: string[];
  } {
    let score = 0;
    const reasons: string[] = [];

    for (const [key, value] of Object.entries(interestDimensions)) {
      if (itemDimensions[key] !== undefined) {
        if (Array.isArray(value)) {
          if (value.includes(itemDimensions[key])) {
            score += 2;
            reasons.push(`dimension ${key} matches`);
          }
        } else if (itemDimensions[key] === value) {
          score += 2;
          reasons.push(`dimension ${key} matches`);
        }
      }
    }

    return { score, reasons };
  }

  findBestMatch(agents: AgentType[], item: BlackboardItem): MatchResult | null {
    const matches = this.match(agents, item);
    return matches.length > 0 ? matches[0] : null;
  }

  findMatchesAboveThreshold(agents: AgentType[], item: BlackboardItem, threshold: number = 5): MatchResult[] {
    const matches = this.match(agents, item);
    return matches.filter((m) => m.score >= threshold);
  }
}

export const interestMatcher = new InterestMatcher();

