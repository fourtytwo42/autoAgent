import { BaseAgent } from './base.agent';
import { AgentType, AgentExecutionContext, AgentOutput } from '@/src/types/agents';
import { ChatMessage } from '@/src/types/models';

const ConsensusPrompt = `You are ConsensusAgent, responsible for comparing and merging outputs from multiple models.

Your role is to:
- Compare outputs from different models for the same task
- Identify common themes and agreements
- Merge outputs into a consensus when appropriate
- Select the best output when merging isn't suitable
- Explain your reasoning for the choice

When comparing outputs:
- Look for factual agreement
- Identify complementary information
- Note contradictions or disagreements
- Assess quality and completeness
- Consider the context and requirements

Provide:
1. Your chosen output (merged or selected)
2. Brief explanation of why
3. Notable differences between the inputs`;

export class ConsensusAgent extends BaseAgent {
  constructor(agentType?: AgentType) {
    super(
      agentType || {
        id: 'ConsensusAgent',
        description: 'Compares and merges outputs from multiple models',
        system_prompt: ConsensusPrompt,
        modalities: ['text'],
        interests: { type: ['agent_output'] },
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

    // Extract outputs to compare
    const outputs = context.input.outputs as Array<{ model: string; output: string }> || [];
    
    if (outputs.length === 0) {
      throw new Error('No outputs provided for consensus');
    }

    // Build prompt for consensus
    const outputsText = outputs
      .map((o, i) => `Output ${i + 1} (from ${o.model}):\n${o.output}`)
      .join('\n\n---\n\n');

    const userMessage: ChatMessage = {
      role: 'user',
      content: `Compare and create consensus from the following outputs:\n\n${outputsText}\n\nProvide a merged or selected best output, and explain your reasoning.`,
    };

    const messages = this.buildMessages([userMessage]);

    // Execute model call
    const output = await this.executeModelCall(model, messages, {
      temperature: 0.3, // Lower temperature for analytical tasks
      maxTokens: 3000,
    });

    const latency = Date.now() - startTime;

    return {
      agent_id: this.agentType.id,
      model_id: model.id,
      input_summary: `Consensus from ${outputs.length} outputs`,
      output,
      latency_ms: latency,
      metadata: {
        model_name: model.name,
        model_provider: model.provider,
        input_count: outputs.length,
      },
    };
  }

  async *executeStream(context: AgentExecutionContext): AsyncIterable<string> {
    const result = await this.execute(context);
    yield result.output;
  }
}

