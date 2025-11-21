import { NextRequest, NextResponse } from 'next/server';
import { ProviderType } from '@/src/types/models';
import { OpenAIProvider } from '@/src/models/providers/openai.provider';
import { AnthropicProvider } from '@/src/models/providers/anthropic.provider';
import { GroqProvider } from '@/src/models/providers/groq.provider';
import { OllamaProvider } from '@/src/models/providers/ollama.provider';
import { LMStudioProvider } from '@/src/models/providers/lmstudio.provider';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const resolvedParams = await params;
    const providerType = resolvedParams.provider as ProviderType;
    
    console.log(`[Models API] Fetching models for provider: ${providerType}`);
    
    let provider;

    switch (providerType) {
      case 'openai':
        provider = new OpenAIProvider();
        break;
      case 'anthropic':
        provider = new AnthropicProvider();
        break;
      case 'groq':
        provider = new GroqProvider();
        break;
      case 'ollama':
        provider = new OllamaProvider();
        break;
      case 'lmstudio':
        provider = new LMStudioProvider();
        break;
      default:
        console.error(`[Models API] Unknown provider: ${providerType}`);
        return NextResponse.json(
          { error: 'Unknown provider', models: [] },
          { status: 400 }
        );
    }

    if (!provider.listModels) {
      console.error(`[Models API] Provider ${providerType} does not support listModels`);
      return NextResponse.json(
        { error: 'Provider does not support model listing', models: [] },
        { status: 501 }
      );
    }

    console.log(`[Models API] Calling listModels() for ${providerType}`);
    const models = await provider.listModels();
    console.log(`[Models API] Retrieved ${models.length} models from ${providerType}`);
    
    return NextResponse.json({ models, count: models.length });
  } catch (error) {
    console.error('[Models API] Error fetching provider models:', error);
    if (error instanceof Error) {
      console.error('[Models API] Error stack:', error.stack);
      console.error('[Models API] Error message:', error.message);
    }
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        models: [],
      },
      { status: 500 }
    );
  }
}

