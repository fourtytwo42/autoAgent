import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Check if we're in build phase
const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build' || 
                     process.env.NEXT_PHASE === 'phase-development-build' ||
                     process.env.NEXT_PHASE === 'phase-export';

const envSchema = z.object({
  // Database - optional during build, required at runtime
  DATABASE_URL: isBuildPhase ? z.string().url().optional() : z.string().url(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Provider API Keys
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),

  // Local providers
  OLLAMA_BASE_URL: z.string().url().optional().default('http://localhost:11434'),
  LM_STUDIO_BASE_URL: z.string().url().optional().default('http://192.168.50.238:1234'),
  
  // Filesystem tool configuration
  FILESYSTEM_WORKSPACE_PATH: z.string().optional().default('./workspace'),

  // Feature flags
  USE_MOCK_PROVIDERS: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),

  // Concurrency
  MAX_CONCURRENT_JOBS: z
    .string()
    .transform((val) => parseInt(val, 10))
    .default('5'),

  // Timeouts
  MODEL_REQUEST_TIMEOUT_MS: z
    .string()
    .transform((val) => parseInt(val, 10))
    .default('60000'),
});

export type Env = z.infer<typeof envSchema>;

let env: Env;

try {
  env = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('❌ Invalid environment variables:');
    error.errors.forEach((err) => {
      console.error(`  - ${err.path.join('.')}: ${err.message}`);
    });
    throw new Error('Invalid environment variables');
  }
  throw error;
}

export { env };

