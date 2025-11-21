# AutoAgent - LLM Hive System

A persistent, self-evolving LLM hive system that runs over multiple models and providers, uses a multi-dimensional blackboard and goal-based agent society, with a Next.js frontend for live introspection and control.

## Features

- **Multi-Provider Support**: OpenAI, Anthropic, Groq, Ollama, LM Studio
- **Model Registry**: Manage models with quality/reliability scores
- **Agent System**: Goal-based agent society with interest matching
- **Blackboard**: Multi-dimensional knowledge store
- **Job Queue**: Reliable task scheduling with retries
- **Streaming**: Real-time response streaming via SSE
- **Comprehensive Testing**: Unit, integration, and E2E tests

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 17+
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/fourtytwo42/autoAgent.git
cd autoAgent
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Set up the database:
```bash
# Database is already created: autoagent_test
# For production, create your own database and update DATABASE_URL in .env
```

5. Initialize the database and seed initial data:
```bash
# Via API (when server is running)
curl -X POST http://localhost:3000/api/init

# Or run migrations manually via test setup
npm run test  # This will also run migrations
```

6. Start the development server:
```bash
npm run dev
```

7. Visit http://localhost:3000

## API Endpoints

### Conversation
- `POST /api/conversation` - Send a message and get a response
- `POST /api/stream` - Stream response (SSE)

### Blackboard
- `GET /api/blackboard` - Query blackboard items
- `POST /api/blackboard` - Create blackboard item
- `GET /api/blackboard/[id]` - Get specific item
- `PUT /api/blackboard/[id]` - Update item
- `DELETE /api/blackboard/[id]` - Delete item

### Agents
- `GET /api/agents` - List agents
  - Query params: `enabled=true`, `core=true`

### Models
- `GET /api/models` - List models
  - Query params: `enabled=true`, `provider=openai`, `modality=vision`

### Health
- `GET /api/health` - Health check

### Initialization
- `POST /api/init` - Initialize database and seed data

## Testing

```bash
# Run all tests
npm test

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Run only E2E tests
npm run test:e2e

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

## Project Structure

```
autoAgent/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── src/                   # Source code
│   ├── agents/            # Agent system
│   ├── blackboard/        # Blackboard service
│   ├── config/            # Configuration
│   ├── db/                # Database layer
│   ├── jobs/              # Job queue & scheduler
│   ├── models/            # Model provider abstraction
│   ├── orchestrator/      # Main orchestrator
│   ├── types/             # TypeScript types
│   └── startup.ts         # Initialization
├── tests/                 # Test files
├── migrations/            # Database migrations
└── Docs/                  # Documentation
```

## Architecture

The system follows a layered architecture:

1. **API Layer** (Next.js routes) → Exposes functionality via HTTP
2. **Orchestrator** → Coordinates workflows and agent execution
3. **Agent System** → Executes agents with model calls
4. **Model Layer** → Unified interface for LLM providers
5. **Blackboard Service** → Manages knowledge items
6. **Job Queue** → Handles async task processing
7. **Database Layer** → Data persistence

## Environment Variables

See `.env.example` for required variables:

- `DATABASE_URL` - PostgreSQL connection string
- `OPENAI_API_KEY` - OpenAI API key (optional if using mock)
- `USE_MOCK_PROVIDERS` - Use mock providers for testing
- `MAX_CONCURRENT_JOBS` - Max concurrent job processing
- `MODEL_REQUEST_TIMEOUT_MS` - Model request timeout

## Development

The system supports development with mock providers (no API keys needed):

```env
USE_MOCK_PROVIDERS=true
```

This enables full functionality testing without external API costs.

## Testing Strategy

- **Unit Tests**: Test pure functions and utilities
- **Integration Tests**: Test database operations and mocked providers
- **E2E Tests**: Test full workflows through API routes

All tests run against a separate test database (`autoagent_test`).

## License

MIT

