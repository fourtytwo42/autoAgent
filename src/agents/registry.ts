import { AgentType, AgentTypeRow } from '@/src/types/agents';
import { agentTypesRepository } from '@/src/db/repositories/agentTypes.repository';

export class AgentRegistry {
  private cache: Map<string, AgentType> = new Map();
  private cacheTimestamp: number = 0;
  private cacheTTL: number = 5 * 60 * 1000; // 5 minutes

  async getAgent(id: string): Promise<AgentType | null> {
    // Check cache first
    if (this.cache.has(id)) {
      const cached = this.cache.get(id)!;
      if (Date.now() - this.cacheTimestamp < this.cacheTTL) {
        return cached;
      }
    }

    // Load from database
    const row = await agentTypesRepository.findById(id);
    if (!row) {
      return null;
    }

    const agent = this.mapRowToAgent(row);
    this.cache.set(id, agent);
    this.cacheTimestamp = Date.now();

    return agent;
  }

  async getEnabledAgents(): Promise<AgentType[]> {
    const rows = await agentTypesRepository.findEnabled();
    return rows.map((row) => this.mapRowToAgent(row));
  }

  async getAllAgents(): Promise<AgentType[]> {
    const rows = await agentTypesRepository.findAll();
    return rows.map((row) => this.mapRowToAgent(row));
  }

  async getCoreAgents(): Promise<AgentType[]> {
    const rows = await agentTypesRepository.findAll({ is_core: true });
    return rows.map((row) => this.mapRowToAgent(row));
  }

  clearCache(): void {
    this.cache.clear();
    this.cacheTimestamp = 0;
  }

  private mapRowToAgent(row: AgentTypeRow): AgentType {
    return {
      id: row.id,
      description: row.description,
      system_prompt: row.system_prompt,
      modalities: row.modalities,
      interests: row.interests,
      permissions: row.permissions,
      is_core: row.is_core,
      is_enabled: row.is_enabled,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

export const agentRegistry = new AgentRegistry();

