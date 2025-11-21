import { ModelConfig } from '@/src/types/models';
import { modelsRepository } from '@/src/db/repositories/models.repository';
import { blackboardRepository } from '@/src/db/repositories/blackboard.repository';

export interface ModelEvaluationResult {
  modelId: string;
  qualityScore: number;
  reliabilityScore: number;
  avgLatency: number;
  totalUses: number;
  successRate: number;
  domainScores: Record<string, number>;
}

export class ModelEvaluator {
  /**
   * Evaluate a model based on judgements in the blackboard
   */
  async evaluateModel(modelId: string): Promise<ModelEvaluationResult | null> {
    // Get all judgements related to this model
    const judgements = await blackboardRepository.query({
      type: 'judgement',
      dimensions: { model_id: modelId },
    });

    if (judgements.length === 0) {
      return null;
    }

    // Get all agent outputs for this model
    const outputs = await blackboardRepository.query({
      type: 'agent_output',
      dimensions: { model_id: modelId },
    });

    // Calculate metrics
    const scores = judgements
      .map((j) => j.dimensions?.score as number)
      .filter((s): s is number => typeof s === 'number' && s >= 0 && s <= 1);

    const qualityScore = scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : 0.5;

    // Calculate reliability (success rate)
    const totalUses = outputs.length;
    const successfulUses = judgements.filter((j) => (j.dimensions?.score as number) >= 0.5).length;
    const reliabilityScore = totalUses > 0 ? successfulUses / totalUses : 0.5;

    // Calculate average latency
    const latencies = outputs
      .map((o) => o.detail?.latency_ms as number)
      .filter((l): l is number => typeof l === 'number' && l > 0);
    const avgLatency = latencies.length > 0
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length
      : 0;

    // Calculate domain-specific scores
    const domainScores: Record<string, number[]> = {};
    judgements.forEach((j) => {
      const domain = j.dimensions?.domain as string;
      const score = j.dimensions?.score as number;
      if (domain && typeof score === 'number') {
        if (!domainScores[domain]) {
          domainScores[domain] = [];
        }
        domainScores[domain].push(score);
      }
    });

    const domainAverages: Record<string, number> = {};
    Object.entries(domainScores).forEach(([domain, scores]) => {
      domainAverages[domain] = scores.reduce((a, b) => a + b, 0) / scores.length;
    });

    return {
      modelId,
      qualityScore,
      reliabilityScore,
      avgLatency: Math.round(avgLatency),
      totalUses,
      successRate: reliabilityScore,
      domainScores: domainAverages,
    };
  }

  /**
   * Update model scores in database based on evaluation
   */
  async updateModelScores(modelId: string): Promise<boolean> {
    const evaluation = await this.evaluateModel(modelId);
    if (!evaluation) {
      return false;
    }

    // Get current model
    const model = await modelsRepository.findById(modelId);
    if (!model) {
      return false;
    }

    // Update with new scores (weighted average with existing)
    const existingQuality = model.quality_score || 0.5;
    const existingReliability = model.reliability_score || 0.5;

    // Use exponential moving average (70% new, 30% old)
    const newQuality = evaluation.qualityScore * 0.7 + existingQuality * 0.3;
    const newReliability = evaluation.reliabilityScore * 0.7 + existingReliability * 0.3;

    await modelsRepository.update(modelId, {
      qualityScore: newQuality,
      reliabilityScore: newReliability,
      avg_latency_ms: evaluation.avgLatency,
      last_benchmarked_at: new Date(),
    });

    return true;
  }

  /**
   * Evaluate all models
   */
  async evaluateAllModels(): Promise<ModelEvaluationResult[]> {
    const models = await modelsRepository.findAll({ is_enabled: true });
    const results: ModelEvaluationResult[] = [];

    for (const model of models) {
      const evaluation = await this.evaluateModel(model.id);
      if (evaluation) {
        results.push(evaluation);
      }
    }

    return results;
  }

  /**
   * Update scores for all models
   */
  async updateAllModelScores(): Promise<number> {
    const models = await modelsRepository.findAll({ is_enabled: true });
    let updated = 0;

    for (const model of models) {
      const success = await this.updateModelScores(model.id);
      if (success) {
        updated++;
      }
    }

    return updated;
  }
}

export const modelEvaluator = new ModelEvaluator();

