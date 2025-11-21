import { NextRequest, NextResponse } from 'next/server';
import { getProviderConfig } from '@/src/config/models';
import { ProviderType } from '@/src/types/models';
import { env } from '@/src/config/env';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const providers: ProviderType[] = ['openai', 'anthropic', 'groq', 'ollama', 'lmstudio'];
    
    const providerConfigs = providers.map(provider => {
      const config = getProviderConfig(provider);
      return {
        id: provider,
        name: provider.charAt(0).toUpperCase() + provider.slice(1),
        hasApiKey: !!config.apiKey,
        hasBaseUrl: !!config.baseUrl,
        baseUrl: config.baseUrl,
        timeout: config.timeout,
        configured: !!(config.apiKey || config.baseUrl),
      };
    });

    return NextResponse.json({ providers: providerConfigs });
  } catch (error) {
    console.error('Error fetching providers:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

