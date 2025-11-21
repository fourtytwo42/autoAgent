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

    return NextResponse.json({ models, count: models.length });
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
