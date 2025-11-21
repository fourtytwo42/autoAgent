import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { modelRegistry } from '@/src/models/registry';
import { modelsRepository } from '@/src/db/repositories/models.repository';
import { ProviderType, Modality } from '@/src/types/models';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const enabledOnly = searchParams.get('enabled') === 'true';
    const provider = searchParams.get('provider');
    const modality = searchParams.get('modality');

    let models;
    if (modality) {
      models = await modelRegistry.getModelsWithModality(modality as Modality);
    } else if (provider) {
      models = await modelRegistry.getModelsByProvider(provider as ProviderType);
    } else if (enabledOnly) {
      models = await modelRegistry.getEnabledModels();
    } else {
      models = await modelRegistry.getAllModels();
    }

    // Format models for frontend with proper metric handling
    const formattedModels = models.map(model => ({
      id: model.id,
      name: model.name,
      provider: model.provider,
      is_enabled: model.is_enabled ?? true,
      modalities: model.modalities,
      quality_score: model.qualityScore ?? 0.5,
      reliability_score: model.reliabilityScore ?? 0.5,
      avg_latency_ms: model.avg_latency_ms ?? null,
      // For LM Studio and Ollama, cost is always N/A
      cost_per_1k_tokens: (model.provider === 'lmstudio' || model.provider === 'ollama') 
        ? null 
        : (model.cost_per_1k_tokens ?? null),
    }));

    return NextResponse.json({ models: formattedModels, count: formattedModels.length });
  } catch (error) {
    console.error('Error in models API:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      provider,
      display_name,
      modalities,
      context_window,
      quality_score = 0.5,
      reliability_score = 0.5,
      cost_per_1k_tokens,
      metadata = {},
    } = body;

    if (!name || !provider) {
      return NextResponse.json(
        { error: 'Name and provider are required' },
        { status: 400 }
      );
    }

    const model = await modelsRepository.create({
      name,
      provider: provider as ProviderType,
      display_name: display_name || name,
      modalities: (modalities || []) as Modality[],
      contextWindow: context_window,
      qualityScore: quality_score,
      reliabilityScore: reliability_score,
      cost_per_1k_tokens,
      metadata,
      is_enabled: true,
    });

    await modelRegistry.refresh();

    return NextResponse.json({ model }, { status: 201 });
  } catch (error) {
    console.error('Error creating model:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
