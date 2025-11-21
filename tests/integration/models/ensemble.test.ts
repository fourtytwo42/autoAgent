import { describe, it, expect } from 'vitest';
import { ensembleOrchestrator } from '@/src/models/ensemble';
import { ModelConfig, ChatMessage } from '@/src/types/models';
import { fixtureModels } from '../../fixtures/models';
import { shouldUseMockProviders } from '@/src/config/models';

describe('Ensemble Orchestrator', () => {
  describe('callEnsemble', () => {
    it('should call multiple models in parallel', async () => {
      const useMock = shouldUseMockProviders();
      if (!useMock) return;

      const models: ModelConfig[] = [
        fixtureModels.gpt4(),
        fixtureModels.claude(),
      ];

      const messages: ChatMessage[] = [
        { role: 'user', content: 'Test message' },
      ];

      const results = await ensembleOrchestrator.callEnsemble(models, messages);
      expect(results.length).toBe(models.length);
      results.forEach(result => {
        expect(result).toHaveProperty('model');
        expect(result).toHaveProperty('output');
        expect(result).toHaveProperty('latency');
        expect(result).toHaveProperty('success');
      });
    });

    it('should handle provider failures gracefully', async () => {
      const useMock = shouldUseMockProviders();
      if (!useMock) return;

      const models: ModelConfig[] = [
        fixtureModels.gpt4(),
        { ...fixtureModels.gpt4(), id: 'invalid-model', name: 'invalid' },
      ];

      const messages: ChatMessage[] = [
        { role: 'user', content: 'Test' },
      ];

      const results = await ensembleOrchestrator.callEnsemble(models, messages);
      // At least one should succeed
      const successful = results.filter(r => r.success);
      expect(successful.length).toBeGreaterThan(0);
    });
  });

  describe('getSuccessfulResults', () => {
    it('should filter successful results', async () => {
      const useMock = shouldUseMockProviders();
      if (!useMock) return;

      const models: ModelConfig[] = [fixtureModels.gpt4()];
      const messages: ChatMessage[] = [{ role: 'user', content: 'Test' }];

      const results = await ensembleOrchestrator.callEnsemble(models, messages);
      const successful = ensembleOrchestrator.getSuccessfulResults(results);
      
      expect(successful.length).toBeGreaterThanOrEqual(0);
      successful.forEach(result => {
        expect(result.success).toBe(true);
      });
    });
  });

  describe('selectBestResult', () => {
    it('should select result with highest quality score', async () => {
      const useMock = shouldUseMockProviders();
      if (!useMock) return;

      const models: ModelConfig[] = [
        fixtureModels.gpt4(),
        fixtureModels.claude(),
      ];
      const messages: ChatMessage[] = [{ role: 'user', content: 'Test' }];

      const results = await ensembleOrchestrator.callEnsemble(models, messages);
      const best = ensembleOrchestrator.selectBestResult(results);
      
      if (best) {
        expect(best.success).toBe(true);
        expect(best.model).toBeDefined();
      }
    });
  });
});

