import { ModelConfig } from '@/types/models';
import { randomUUID } from 'crypto';

export function createTestModel(overrides: Partial<ModelConfig> = {}): ModelConfig {
  return {
    id: randomUUID(),
    name: 'test-model',
    provider: 'openai',
    modalities: ['text'],
    contextWindow: 4000,
    qualityScore: 0.8,
    reliabilityScore: 0.9,
    metadata: {},
    ...overrides,
  };
}

export const fixtureModels = {
  gpt4: (): ModelConfig => createTestModel({
    name: 'gpt-4',
    provider: 'openai',
    modalities: ['text'],
    contextWindow: 8192,
    qualityScore: 0.95,
    reliabilityScore: 0.98,
  }),
  
  claude: (): ModelConfig => createTestModel({
    name: 'claude-3-opus',
    provider: 'anthropic',
    modalities: ['text', 'vision'],
    contextWindow: 200000,
    qualityScore: 0.93,
    reliabilityScore: 0.97,
  }),
  
  llama: (): ModelConfig => createTestModel({
    name: 'llama3-70b',
    provider: 'ollama',
    modalities: ['text'],
    contextWindow: 8192,
    qualityScore: 0.75,
    reliabilityScore: 0.85,
    metadata: { local: true, cost: 0 },
  }),
  
  visionModel: (): ModelConfig => createTestModel({
    name: 'gpt-4-vision',
    provider: 'openai',
    modalities: ['text', 'vision'],
    contextWindow: 128000,
    qualityScore: 0.92,
    reliabilityScore: 0.96,
  }),
  
  cheapModel: (): ModelConfig => createTestModel({
    name: 'gpt-3.5-turbo',
    provider: 'openai',
    modalities: ['text'],
    contextWindow: 4096,
    qualityScore: 0.7,
    reliabilityScore: 0.88,
    metadata: { cost: 0.0005 },
  }),
};

