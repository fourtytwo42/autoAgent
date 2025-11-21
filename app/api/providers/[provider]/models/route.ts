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
  { params }: { params: { provider: string } }
) {
  try {
    const providerType = params.provider as ProviderType;
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
        return NextResponse.json(
          { error: 'Unknown provider', models: [] },
          { status: 400 }
        );
    }

    if (!provider.listModels) {
      return NextResponse.json(
        { error: 'Provider does not support model listing', models: [] },
        { status: 501 }
      );
    }

    const models = await provider.listModels();
    return NextResponse.json({ models, count: models.length });
  } catch (error) {
    console.error('Error fetching provider models:', error);
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

