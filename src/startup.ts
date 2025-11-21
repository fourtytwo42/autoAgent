import { runMigrations } from './db/migrations';
import { testConnection } from './config/database';
import { jobScheduler } from './jobs/scheduler';
import { agentTypesRepository } from './db/repositories/agentTypes.repository';
import { initializeTools } from './tools/init';
import { WeSpeakerPrompt } from './agents/prompts/wespeaker.prompt';
import { TaskPlannerPrompt } from './agents/prompts/taskPlanner.prompt';
import { JudgePrompt } from './agents/prompts/judge.prompt';
import { StewardPrompt } from './agents/prompts/steward.prompt';
import { ArchitectureEngineerPrompt } from './agents/prompts/architectureEngineer.prompt';
import { MemoryCuratorPrompt } from './agents/prompts/memoryCurator.prompt';
import { GoalRefinerPrompt } from './agents/prompts/goalRefiner.prompt';
import { WorkerPrompt } from './agents/prompts/worker.prompt';
import { ResearchWorkerPrompt } from './agents/prompts/researchWorker.prompt';
import { WritingWorkerPrompt } from './agents/prompts/writingWorker.prompt';
import { AnalysisWorkerPrompt } from './agents/prompts/analysisWorker.prompt';
import { SummarizerPrompt } from './agents/prompts/summarizer.prompt';

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

      // Initialize tools
      console.log('🔧 Initializing tools...');
      initializeTools();
      console.log('✅ Tools initialized');

      // Start job scheduler
      console.log('⚙️  Starting job scheduler...');
      jobScheduler.start(5000); // Poll every 5 seconds
      console.log('✅ Job scheduler started');

      console.log('✅ AutoAgent initialized successfully');
}

async function seedInitialData(): Promise<void> {
  // Create core agents if they don't exist
  const agents = [
    {
      id: 'GoalRefiner',
      description: 'Refines user requests into well-defined goals',
      system_prompt: GoalRefinerPrompt,
      modalities: ['text'],
      interests: { type: ['user_request'] },
      permissions: { can_use_tools: [], can_create_goals: false },
      is_core: true,
      is_enabled: true,
    },
    {
      id: 'WeSpeaker',
      description: 'User-facing conversational agent',
      system_prompt: WeSpeakerPrompt,
      modalities: ['text'],
      interests: { type: ['user_request', 'task'] },
      permissions: { can_use_tools: ['web_search'], can_create_goals: true },
      is_core: true,
      is_enabled: true,
    },
    {
      id: 'TaskPlanner',
      description: 'Breaks down goals into actionable tasks',
      system_prompt: TaskPlannerPrompt,
      modalities: ['text'],
      interests: { type: ['goal'], dimensions: { status: 'open' } },
      permissions: { can_use_tools: [], can_create_goals: false },
      is_core: true,
      is_enabled: true,
    },
    {
      id: 'Judge',
      description: 'Evaluates agent outputs and provides quality scores',
      system_prompt: JudgePrompt,
      modalities: ['text'],
      interests: { type: ['agent_output'], dimensions: { status: 'completed' } },
      permissions: { can_use_tools: [], can_create_goals: false },
      is_core: true,
      is_enabled: true,
    },
    {
      id: 'Steward',
      description: 'Manages goal prioritization and resource allocation',
      system_prompt: StewardPrompt,
      modalities: ['text'],
      interests: { type: ['goal'] },
      permissions: { can_use_tools: [], can_create_goals: false },
      is_core: true,
      is_enabled: true,
    },
    {
      id: 'ModelEvaluator',
      description: 'Evaluates model performance and updates scores',
      system_prompt: 'You are ModelEvaluator, responsible for evaluating the performance of LLM models used by the hive.',
      modalities: ['text'],
      interests: { type: ['judgement', 'metric'] },
      permissions: { can_use_tools: [], can_create_goals: false },
      is_core: true,
      is_enabled: true,
    },
    {
      id: 'ArchitectureEngineer',
      description: 'Analyzes system architecture and proposes improvements',
      system_prompt: ArchitectureEngineerPrompt,
      modalities: ['text'],
      interests: { type: ['agent_proposal', 'metric'] },
      permissions: { can_use_tools: [], can_create_goals: false },
      is_core: true,
      is_enabled: true,
    },
    {
      id: 'MemoryCurator',
      description: 'Maintains and optimizes the knowledge base',
      system_prompt: MemoryCuratorPrompt,
      modalities: ['text'],
      interests: { type: ['goal', 'task', 'agent_output'] },
      permissions: { can_use_tools: [], can_create_goals: false },
      is_core: true,
      is_enabled: true,
    },
    {
      id: 'Worker',
      description: 'General-purpose task execution agent',
      system_prompt: WorkerPrompt,
      modalities: ['text'],
      interests: { type: ['task'] },
      permissions: { can_use_tools: [], can_create_goals: false },
      is_core: true,
      is_enabled: true,
    },
    {
      id: 'ResearchWorker',
      description: 'Specialized agent for research and information gathering tasks',
      system_prompt: ResearchWorkerPrompt,
      modalities: ['text'],
      interests: { type: ['task'], dimensions: { task_type: 'research' } },
      permissions: { can_use_tools: ['web_search'], can_create_goals: false },
      is_core: true,
      is_enabled: true,
    },
    {
      id: 'WritingWorker',
      description: 'Specialized agent for writing tasks',
      system_prompt: WritingWorkerPrompt,
      modalities: ['text'],
      interests: { type: ['task'], dimensions: { task_type: 'writing' } },
      permissions: { can_use_tools: [], can_create_goals: false },
      is_core: true,
      is_enabled: true,
    },
    {
      id: 'AnalysisWorker',
      description: 'Specialized agent for analysis tasks',
      system_prompt: AnalysisWorkerPrompt,
      modalities: ['text'],
      interests: { type: ['task'], dimensions: { task_type: 'analysis' } },
      permissions: { can_use_tools: [], can_create_goals: false },
      is_core: true,
      is_enabled: true,
    },
    {
      id: 'Summarizer',
      description: 'Creates concise summaries of agent outputs for the blackboard',
      system_prompt: SummarizerPrompt,
      modalities: ['text'],
      interests: { type: ['agent_output'], dimensions: { status: 'completed' } },
      permissions: { can_use_tools: [], can_create_goals: false },
      is_core: true,
      is_enabled: true,
    },
  ];

  for (const agentSpec of agents) {
    const existing = await agentTypesRepository.findById(agentSpec.id);
    if (!existing) {
      await agentTypesRepository.create(agentSpec);
      console.log(`✅ Created ${agentSpec.id} agent`);
    } else {
      // Update existing agent to ensure interests are current
      await agentTypesRepository.update(agentSpec.id, {
        interests: agentSpec.interests,
        description: agentSpec.description,
        system_prompt: agentSpec.system_prompt,
      });
    }
  }
}

