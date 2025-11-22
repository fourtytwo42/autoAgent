import { NextRequest, NextResponse } from 'next/server';
import { providerConfigsRepository, ProviderConfig } from '@/src/db/providerConfigs.repository';
import { ProviderType } from '@/src/types/models';
import { clearProviderConfigCache } from '@/src/config/models';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider } = await params;
    
    if (!['openai', 'anthropic', 'groq', 'ollama', 'lmstudio'].includes(provider)) {
      return NextResponse.json(
        { error: 'Invalid provider' },
        { status: 400 }
      );
    }

    const config = await providerConfigsRepository.get(provider as ProviderType);
    
    if (!config) {
      return NextResponse.json(
        { error: 'Provider config not found' },
        { status: 404 }
      );
    }

    // Don't expose the full API key, just indicate if it's set
    return NextResponse.json({
      provider,
      hasApiKey: !!config.apiKey,
      hasBaseUrl: !!config.baseUrl,
      baseUrl: config.baseUrl,
      timeout: config.timeout || 60000,
      isEnabled: config.isEnabled !== false,
      metadata: config.metadata || {},
    });
  } catch (error) {
    console.error('Error fetching provider config:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider } = await params;
    
    if (!['openai', 'anthropic', 'groq', 'ollama', 'lmstudio'].includes(provider)) {
      return NextResponse.json(
        { error: 'Invalid provider' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const updates: Partial<ProviderConfig> = {};

    // Only update API key if a new value is provided (empty string clears it)
    if (body.apiKey !== undefined && body.apiKey !== null && body.apiKey !== '***') {
      updates.apiKey = body.apiKey || undefined;
    }
    
    if (body.baseUrl !== undefined) {
      updates.baseUrl = body.baseUrl || undefined;
    }
    
    if (body.timeout !== undefined) {
      updates.timeout = parseInt(String(body.timeout), 10);
    }
    
    if (body.isEnabled !== undefined) {
      updates.isEnabled = body.isEnabled;
    }
    
    if (body.metadata !== undefined) {
      updates.metadata = body.metadata;
    }

    await providerConfigsRepository.update(provider as ProviderType, updates);
    
    // Clear cache so changes take effect immediately
    clearProviderConfigCache();
    
    // Get updated config
    const updatedConfig = await providerConfigsRepository.get(provider as ProviderType);
    
    return NextResponse.json({
      provider,
      hasApiKey: !!updatedConfig?.apiKey,
      hasBaseUrl: !!updatedConfig?.baseUrl,
      baseUrl: updatedConfig?.baseUrl,
      timeout: updatedConfig?.timeout,
      isEnabled: updatedConfig?.isEnabled !== false,
      metadata: updatedConfig?.metadata,
    });
  } catch (error) {
    console.error('Error updating provider config:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

