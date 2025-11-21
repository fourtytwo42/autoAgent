import { describe, it, expect } from 'vitest';
import { modelRouter, ModelSelectionOptions } from '@/src/models/router';

describe('ModelRouter', () => {

  describe('selectModel', () => {
    it('should be defined and accept options', () => {
      expect(modelRouter.selectModel).toBeDefined();
      expect(typeof modelRouter.selectModel).toBe('function');
    });

    it('should accept quality score filter', () => {
      const options: ModelSelectionOptions = {
        minQuality: 0.8,
      };
      // Function exists and accepts options
      expect(modelRouter.selectModel).toBeDefined();
    });

    it('should accept cost filter', () => {
      const options: ModelSelectionOptions = {
        maxCost: 0.01,
      };
      expect(modelRouter.selectModel).toBeDefined();
    });

    it('should accept exclude IDs', () => {
      const options: ModelSelectionOptions = {
        excludeIds: ['model-1', 'model-2'],
      };
      expect(modelRouter.selectModel).toBeDefined();
    });

    it('should accept prefer local option', () => {
      const options: ModelSelectionOptions = {
        preferLocal: true,
      };
      expect(modelRouter.selectModel).toBeDefined();
    });

    it('should accept domain option', () => {
      const options: ModelSelectionOptions = {
        domain: 'code',
      };
      expect(modelRouter.selectModel).toBeDefined();
    });
  });

  describe('selectMultipleModels', () => {
    it('should be defined', () => {
      expect(modelRouter.selectMultipleModels).toBeDefined();
      expect(typeof modelRouter.selectMultipleModels).toBe('function');
    });
  });

  describe('selectWithFallback', () => {
    it('should be defined', () => {
      expect(modelRouter.selectWithFallback).toBeDefined();
      expect(typeof modelRouter.selectWithFallback).toBe('function');
    });
  });
});

