import { ModelConfig, ChatMessage, ModelExecutionOptions } from '@/src/types/models';
import { modelExecutor } from './executor';

export interface EnsembleResult {
  model: ModelConfig;
  output: string;
  latency: number;
  success: boolean;
  error?: Error;
}

export interface ConsensusOptions {
  strategy: 'best' | 'merge' | 'vote';
  minAgreement?: number; // For vote strategy
}

export class EnsembleOrchestrator {
  /**
   * Call multiple models in parallel with the same prompt
   */
  async callEnsemble(
    models: ModelConfig[],
    messages: ChatMessage[],
    options?: ModelExecutionOptions
  ): Promise<EnsembleResult[]> {
    const promises = models.map(async (model) => {
      const startTime = Date.now();
      try {
        const output = await modelExecutor.generateText(model, messages, options);
        const latency = Date.now() - startTime;

        return {
          model,
          output,
          latency,
          success: true,
        } as EnsembleResult;
      } catch (error) {
        const latency = Date.now() - startTime;

        return {
          model,
          output: '',
          latency,
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
        } as EnsembleResult;
      }
    });

    return Promise.all(promises);
  }

  /**
   * Get successful results from ensemble call
   */
  getSuccessfulResults(results: EnsembleResult[]): EnsembleResult[] {
    return results.filter((r) => r.success);
  }

  /**
   * Select best result based on model quality scores
   */
  selectBestResult(results: EnsembleResult[]): EnsembleResult | null {
    const successful = this.getSuccessfulResults(results);
    if (successful.length === 0) {
      return null;
    }

    // Sort by quality score
    successful.sort((a, b) => {
      const aScore = a.model.qualityScore * 0.7 + a.model.reliabilityScore * 0.3;
      const bScore = b.model.qualityScore * 0.7 + b.model.reliabilityScore * 0.3;
      return bScore - aScore;
    });

    return successful[0];
  }

  /**
   * Select fastest successful result
   */
  selectFastestResult(results: EnsembleResult[]): EnsembleResult | null {
    const successful = this.getSuccessfulResults(results);
    if (successful.length === 0) {
      return null;
    }

    successful.sort((a, b) => a.latency - b.latency);
    return successful[0];
  }

  /**
   * Get consensus from multiple results
   * This is a simplified version - a full implementation would use a ConsensusAgent
   */
  async getConsensus(
    results: EnsembleResult[],
    options: ConsensusOptions = { strategy: 'best' }
  ): Promise<string | null> {
    const successful = this.getSuccessfulResults(results);
    if (successful.length === 0) {
      return null;
    }

    switch (options.strategy) {
      case 'best':
        const best = this.selectBestResult(successful);
        return best?.output || null;

      case 'merge':
        // Simple merge: concatenate outputs (in production, would use ConsensusAgent)
        return successful.map((r) => r.output).join('\n\n---\n\n');

      case 'vote':
        // For vote strategy, would need ConsensusAgent to analyze and vote
        // For now, return best result
        const bestVote = this.selectBestResult(successful);
        return bestVote?.output || null;

      default:
        return this.selectBestResult(successful)?.output || null;
    }
  }

  /**
   * Stream from multiple models and aggregate
   */
  async *streamEnsemble(
    models: ModelConfig[],
    messages: ChatMessage[],
    options?: ModelExecutionOptions
  ): AsyncIterable<string> {
    // For streaming ensemble, we stream from the best model
    // In a full implementation, we might stream from multiple and merge
    const bestModel = models.sort((a, b) => {
      const aScore = a.qualityScore * 0.7 + a.reliabilityScore * 0.3;
      const bScore = b.qualityScore * 0.7 + b.reliabilityScore * 0.3;
      return bScore - aScore;
    })[0];

    yield* modelExecutor.generateTextStream(bestModel, messages, options);
  }
}

export const ensembleOrchestrator = new EnsembleOrchestrator();

