import { BaseAgent } from './base.agent';
import { AgentType, AgentExecutionContext, AgentOutput } from '@/src/types/agents';
import { ChatMessage } from '@/src/types/models';
import { ArchitectureEngineerPrompt } from '../prompts/architectureEngineer.prompt';
import { proposalManager } from '../proposals';
import { agentRegistry } from '../registry';

export class ArchitectureEngineerAgent extends BaseAgent {
  constructor(agentType?: AgentType) {
    super(
      agentType || {
        id: 'ArchitectureEngineer',
        description: 'Analyzes system architecture and proposes improvements',
        system_prompt: ArchitectureEngineerPrompt,
        modalities: ['text'],
        interests: { type: ['agent_proposal', 'metric'] },
        permissions: { can_use_tools: [], can_create_goals: false },
        is_core: true,
        is_enabled: true,
      }
    );
  }

  async execute(context: AgentExecutionContext): Promise<AgentOutput> {
    const startTime = Date.now();

    // Select model
    const model = await this.selectModel(['text']);

    // Extract task from context
    const task = context.input.task as string || 'analyze_architecture';
    const proposalId = context.input.proposal_id as string;

    let userMessage: ChatMessage;

    if (task === 'evaluate_proposal' && proposalId) {
      // Evaluate a specific proposal
      const proposals = await proposalManager.getPendingProposals();
      const proposal = proposals.find(p => p.id === proposalId);
      
      if (proposal) {
        userMessage = {
          role: 'user',
          content: `Evaluate the following agent proposal:\n\n${JSON.stringify(proposal.detail, null, 2)}\n\nProvide:\n1. A score (0.0 to 1.0)\n2. Your vote (approve/reject)\n3. Detailed reasoning`,
        };
      } else {
        userMessage = {
          role: 'user',
          content: 'Proposal not found',
        };
      }
    } else {
      // Analyze architecture and propose improvements
      const agents = await agentRegistry.getAllAgents();
      const proposals = await proposalManager.getPendingProposals();

      userMessage = {
        role: 'user',
        content: `Analyze the current system architecture:\n\nAgents: ${agents.length}\nPending Proposals: ${proposals.length}\n\nProvide:\n1. Architecture analysis\n2. Identified bottlenecks\n3. Recommendations for new agents or improvements`,
      };
    }

    const messages = this.buildMessages([userMessage]);

    // Execute model call
    const output = await this.executeModelCall(model, messages, {
      temperature: 0.4, // Lower temperature for analytical tasks
      maxTokens: 20000,
    });

    const latency = Date.now() - startTime;

    return {
      agent_id: this.agentType.id,
      model_id: model.id,
      input_summary: task,
      output,
      latency_ms: latency,
      metadata: {
        model_name: model.name,
        model_provider: model.provider,
        task,
      },
    };
  }

  async *executeStream(context: AgentExecutionContext): AsyncIterable<string> {
    const result = await this.execute(context);
    yield result.output;
  }
}

