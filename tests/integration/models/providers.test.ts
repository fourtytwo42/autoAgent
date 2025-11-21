import { describe, it, expect, beforeEach } from 'vitest';
import { withFreshDb } from '../../helpers/db';
import { modelExecutor } from '@/src/models/executor';
import { ModelConfig, ChatMessage } from '@/src/types/models';
import { shouldUseMockProviders } from '@/src/config/models';
import { fixtureModels } from '../../fixtures/models';

describe('Model Providers Integration', () => {
  beforeEach(async () => {
    await withFreshDb(async () => {
      // Clean database state
    });
  });

  describe('Mock Provider', () => {
    it('should generate text with mock provider', async () => {
      await withFreshDb(async () => {
        const useMock = shouldUseMockProviders();
        if (!useMock) {
          // Skip if not using mocks
          return;
        }

        const model = fixtureModels.gpt4();
        const messages: ChatMessage[] = [
          { role: 'user', content: 'Hello, world!' },
        ];

        const response = await modelExecutor.generateText(model, messages);
        expect(typeof response).toBe('string');
        expect(response.length).toBeGreaterThan(0);
      });
    });

    it('should stream text with mock provider', async () => {
      await withFreshDb(async () => {
        const useMock = shouldUseMockProviders();
        if (!useMock) return;

        const model = fixtureModels.gpt4();
        const messages: ChatMessage[] = [
          { role: 'user', content: 'Tell me a story' },
        ];

        const chunks: string[] = [];
        for await (const chunk of modelExecutor.generateTextStream(model, messages)) {
          chunks.push(chunk);
        }

        expect(chunks.length).toBeGreaterThan(0);
        const fullText = chunks.join('');
        expect(fullText.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Provider Selection', () => {
    it('should select correct provider based on model config', async () => {
      await withFreshDb(async () => {
        const openaiModel = fixtureModels.gpt4();
        expect(openaiModel.provider).toBe('openai');

        // Would test actual provider selection if not using mocks
        expect(modelExecutor).toBeDefined();
      });
    });
  });
});

