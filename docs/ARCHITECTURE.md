# System Architecture

## Overview

AutoAgent is a persistent, self-evolving LLM hive system that coordinates multiple AI models and agents to accomplish complex tasks.

## Core Components

### 1. Model Layer
- **Providers**: OpenAI, Anthropic, Groq, Ollama, LM Studio
- **Registry**: Manages model configurations and metadata
- **Router**: Selects optimal models based on agent preferences, domain, cost, latency
- **Executor**: Unified interface for model calls
- **Evaluator**: Tracks and updates model performance scores

### 2. Agent System
- **Registry**: Manages agent type definitions
- **Matcher**: Matches tasks to agents based on interests
- **Executor**: Executes agent logic with model calls
- **Agents**: 
  - WeSpeaker: User-facing conversational agent
  - TaskPlanner: Breaks goals into tasks
  - Judge: Evaluates agent outputs
  - Steward: Manages goal prioritization
  - ModelEvaluator: Evaluates model performance
  - ConsensusAgent: Merges multiple model outputs
  - ArchitectureEngineer: Analyzes and improves architecture
  - MemoryCurator: Maintains knowledge base

### 3. Blackboard
- Multi-dimensional knowledge store
- Stores: user requests, goals, tasks, agent outputs, judgements, proposals
- Query builder for flexible filtering
- Links between related items

### 4. Job Queue & Scheduler
- Reliable task scheduling
- Retry logic with exponential backoff
- Job locking to prevent duplicate execution
- Processors for different job types

### 5. Orchestrator
- Coordinates overall system workflow
- Manages user requests
- Creates goals and tasks
- Executes agents
- Handles streaming responses

### 6. Tools System
- Tool registry for external capabilities
- Web search tool
- Filesystem tool (with security restrictions)
- Custom API tool
- Tool execution integrated into agents

## Data Flow

1. **User Request** → Orchestrator
2. Orchestrator creates **User Request** in blackboard
3. Orchestrator creates **Goal** from user request
4. **TaskPlanner** creates **Tasks** for the goal
5. **Steward** prioritizes goals
6. **Agent Matcher** finds agents for tasks
7. **Agents** execute using **Model Router** to select models
8. **Model Executor** calls providers
9. **Agent Output** saved to blackboard
10. **Judge** evaluates outputs
11. **Model Evaluator** updates model scores

## Database Schema

- `models` - Model configurations and metrics
- `agent_types` - Agent definitions
- `agent_metrics` - Agent performance metrics
- `agent_model_prefs` - Agent model preferences
- `blackboard_items` - Knowledge items
- `jobs` - Job queue
- `events` - Event log

## Frontend

- Next.js App Router
- React components with hooks
- Real-time updates via SSE
- Debug panels for introspection
- Multiple views: Conversation, Blackboard, Agents, Models, Timeline

## Security Considerations

- Database connections lazy-loaded (no build-time access)
- Filesystem tool has path restrictions
- Tool permissions checked per agent
- Environment variables validated

