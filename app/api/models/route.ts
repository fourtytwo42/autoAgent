import { NextRequest, NextResponse } from 'next/server';
import { modelRegistry } from '@/src/models/registry';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const enabledOnly = searchParams.get('enabled') === 'true';
    const provider = searchParams.get('provider');
    const modality = searchParams.get('modality');

    let models;
    if (modality) {
      models = await modelRegistry.getModelsWithModality(modality);
    } else if (provider) {
      models = await modelRegistry.getModelsByProvider(provider as any);
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

