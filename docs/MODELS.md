# Model Configuration Guide

## Supported Providers

### OpenAI
- Models: gpt-4, gpt-4-turbo, gpt-3.5-turbo, etc.
- Modalities: text, vision
- API Key: `OPENAI_API_KEY`

### Anthropic
- Models: claude-3-opus, claude-3-sonnet, claude-3-haiku
- Modalities: text, vision
- API Key: `ANTHROPIC_API_KEY`

### Groq
- Models: llama3-70b, mixtral-8x7b, etc.
- Modalities: text
- API Key: `GROQ_API_KEY`

### Ollama (Local)
- Models: Any model available in Ollama
- Modalities: text
- Base URL: `OLLAMA_BASE_URL` (default: http://localhost:11434)

### LM Studio (Local)
- Models: Any model loaded in LM Studio
- Modalities: text
- Base URL: `LM_STUDIO_BASE_URL` (default: http://localhost:1234)

## Model Selection

Models are selected based on:
- Agent preferences (from `agent_model_prefs`)
- Required modalities
- Quality and reliability scores
- Cost constraints
- Latency requirements
- Domain-specific routing

## Domain Routing

Domains configured in router:
- `code` - High quality, reasoning models
- `design` - Creative models
- `math` - High quality, reasoning models
- `creative` - Creative models, prefer local
- `reasoning` - Highest quality models

## Model Evaluation

Models are automatically evaluated based on:
- Judgement scores from Judge agent
- Success rate (reliability)
- Average latency
- Domain-specific performance

Scores updated via exponential moving average.

## Adding Models

1. Insert into `models` table
2. Set quality_score and reliability_score
3. Configure modalities
4. Set cost_per_1k_tokens if known
5. Enable/disable as needed

