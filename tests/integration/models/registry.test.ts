import { describe, it, expect, beforeEach } from 'vitest';
import { withFreshDb } from '../../helpers/db';
import { Pool } from 'pg';
import { fixtureModels } from '../../fixtures/models';
import { ModelConfig } from '../../../types/models';

/**
 * Integration test for model registry operations
 */
describe('Model Registry', () => {
  it('should create a model in the registry', async () => {
    await withFreshDb(async (db: Pool) => {
      const model = fixtureModels.gpt4();
      
      const result = await db.query(
        `INSERT INTO models (id, name, provider, display_name, is_enabled, modalities, context_window, quality_score, reliability_score, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          model.id,
          model.name,
          model.provider,
          model.name,
          true,
          model.modalities,
          model.contextWindow,
          model.qualityScore,
          model.reliabilityScore,
          JSON.stringify(model.metadata),
        ]
      );

      expect(result.rows).toHaveLength(1);
      const created = result.rows[0];
      expect(created.id).toBe(model.id);
      expect(created.name).toBe('gpt-4');
      expect(created.provider).toBe('openai');
      expect(created.quality_score).toBe(0.95);
    });
  });

  it('should query enabled models only', async () => {
    await withFreshDb(async (db: Pool) => {
      const model1 = fixtureModels.gpt4();
      const model2 = fixtureModels.cheapModel();
      
      // Create enabled and disabled models
      await db.query(
        `INSERT INTO models (id, name, provider, display_name, is_enabled, modalities, quality_score, reliability_score, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [model1.id, model1.name, model1.provider, model1.name, true, model1.modalities, model1.qualityScore, model1.reliabilityScore, JSON.stringify(model1.metadata)]
      );

      await db.query(
        `INSERT INTO models (id, name, provider, display_name, is_enabled, modalities, quality_score, reliability_score, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [model2.id, model2.name, model2.provider, model2.name, false, model2.modalities, model2.qualityScore, model2.reliabilityScore, JSON.stringify(model2.metadata)]
      );

      // Query enabled models
      const result = await db.query(
        'SELECT * FROM models WHERE is_enabled = true'
      );

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].id).toBe(model1.id);
    });
  });

  it('should filter models by modality', async () => {
    await withFreshDb(async (db: Pool) => {
      const textModel = fixtureModels.gpt4();
      const visionModel = fixtureModels.visionModel();
      
      await db.query(
        `INSERT INTO models (id, name, provider, display_name, is_enabled, modalities, quality_score, reliability_score, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [textModel.id, textModel.name, textModel.provider, textModel.name, true, textModel.modalities, textModel.qualityScore, textModel.reliabilityScore, JSON.stringify(textModel.metadata)]
      );

      await db.query(
        `INSERT INTO models (id, name, provider, display_name, is_enabled, modalities, quality_score, reliability_score, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [visionModel.id, visionModel.name, visionModel.provider, visionModel.name, true, visionModel.modalities, visionModel.qualityScore, visionModel.reliabilityScore, JSON.stringify(visionModel.metadata)]
      );

      // Query models with vision modality
      const result = await db.query(
        "SELECT * FROM models WHERE 'vision' = ANY(modalities)"
      );

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].id).toBe(visionModel.id);
    });
  });

  it('should update model quality and reliability scores', async () => {
    await withFreshDb(async (db: Pool) => {
      const model = fixtureModels.gpt4();
      
      // Create model
      await db.query(
        `INSERT INTO models (id, name, provider, display_name, is_enabled, modalities, quality_score, reliability_score, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [model.id, model.name, model.provider, model.name, true, model.modalities, model.qualityScore, model.reliabilityScore, JSON.stringify(model.metadata)]
      );

      // Update scores
      await db.query(
        `UPDATE models 
         SET quality_score = $1, reliability_score = $2, updated_at = now()
         WHERE id = $3`,
        [0.99, 0.98, model.id]
      );

      // Verify update
      const result = await db.query(
        'SELECT * FROM models WHERE id = $1',
        [model.id]
      );

      expect(result.rows[0].quality_score).toBe(0.99);
      expect(result.rows[0].reliability_score).toBe(0.98);
    });
  });
});

