# Deployment Guide

## Prerequisites

- Node.js 20+
- PostgreSQL 17+
- npm or yarn

## Environment Setup

1. Copy `.env.example` to `.env`
2. Configure environment variables:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/autoagent

# Provider API Keys
OPENAI_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here
GROQ_API_KEY=your_key_here

# Local Providers
OLLAMA_BASE_URL=http://localhost:11434
LM_STUDIO_BASE_URL=http://localhost:1234

# Feature Flags
USE_MOCK_PROVIDERS=false

# Concurrency
MAX_CONCURRENT_JOBS=5

# Timeouts
MODEL_REQUEST_TIMEOUT_MS=60000
```

## Database Setup

1. Create database:
```sql
CREATE DATABASE autoagent;
```

2. Run migrations:
```bash
# Via API (after starting server)
curl -X POST http://localhost:3000/api/init

# Or manually
psql -d autoagent -f migrations/001_initial_schema.sql
```

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

Visit http://localhost:3000

## Production Build

```bash
npm run build
npm start
```

## Testing

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Coverage
npm run test:coverage
```

## Monitoring

- Health endpoint: `GET /api/health`
- Check database connectivity
- Monitor job queue status
- Track model and agent metrics

## Troubleshooting

### Build Errors
- Ensure DATABASE_URL is set (or optional during build)
- Check that all dependencies are installed

### Database Connection Issues
- Verify PostgreSQL is running
- Check DATABASE_URL format
- Ensure database exists and user has permissions

### Provider Errors
- Verify API keys are set
- Check provider availability
- Use `USE_MOCK_PROVIDERS=true` for testing

