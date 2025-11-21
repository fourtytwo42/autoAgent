import { NextRequest, NextResponse } from 'next/server';
import { modelRegistry } from '@/src/models/registry';
import { modelsRepository } from '@/src/db/repositories/models.repository';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const body = await request.json();
    const { is_enabled, quality_score, reliability_score, avg_latency_ms, cost_per_1k_tokens } = body;

    const updates: any = {};
    if (typeof is_enabled === 'boolean') updates.is_enabled = is_enabled;
    if (typeof quality_score === 'number') updates.qualityScore = quality_score;
    if (typeof reliability_score === 'number') updates.reliabilityScore = reliability_score;
    if (typeof avg_latency_ms === 'number') updates.avg_latency_ms = avg_latency_ms;
    if (typeof cost_per_1k_tokens === 'number') updates.cost_per_1k_tokens = cost_per_1k_tokens;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid updates provided' }, { status: 400 });
    }

    const updated = await modelsRepository.update(resolvedParams.id, updates);
    
    // Refresh registry cache
    await modelRegistry.refresh();

    return NextResponse.json({ model: updated });
  } catch (error) {
    console.error('Error updating model:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    await modelsRepository.delete(resolvedParams.id);
    await modelRegistry.refresh();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting model:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

