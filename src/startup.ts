import { runMigrations } from './db/migrations';
import { testConnection } from './config/database';
import { jobScheduler } from './jobs/scheduler';
import { agentTypesRepository } from './db/repositories/agentTypes.repository';
import { WeSpeakerPrompt } from './agents/prompts/wespeaker.prompt';

/**
 * Initialize the application:
 * - Test database connection
 * - Run migrations
 * - Seed initial data (if needed)
 * - Start job scheduler
 */
export async function initialize(): Promise<void> {
  console.log('🚀 Initializing AutoAgent...');

  // Test database connection
  console.log('📊 Testing database connection...');
  const dbConnected = await testConnection();
  if (!dbConnected) {
    throw new Error('Failed to connect to database');
  }
  console.log('✅ Database connected');

  // Run migrations
  console.log('🔄 Running migrations...');
  await runMigrations();
  console.log('✅ Migrations complete');

  // Seed initial data
  console.log('🌱 Seeding initial data...');
  await seedInitialData();
  console.log('✅ Initial data seeded');

  // Start job scheduler
  console.log('⚙️  Starting job scheduler...');
  jobScheduler.start(5000); // Poll every 5 seconds
  console.log('✅ Job scheduler started');

  console.log('✅ AutoAgent initialized successfully');
}

async function seedInitialData(): Promise<void> {
  // Check if WeSpeaker agent exists
  const existingAgent = await agentTypesRepository.findById('WeSpeaker');
  
  if (!existingAgent) {
    // Create WeSpeaker agent
    await agentTypesRepository.create({
      id: 'WeSpeaker',
      description: 'User-facing conversational agent',
      system_prompt: WeSpeakerPrompt,
      modalities: ['text'],
      interests: { type: ['user_request'] },
      permissions: { can_use_tools: ['web_search'], can_create_goals: true },
      is_core: true,
      is_enabled: true,
    });
    console.log('✅ Created WeSpeaker agent');
  }
}

