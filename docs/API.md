# API Documentation

## Overview

The AutoAgent API provides endpoints for interacting with the LLM hive system. All endpoints are under `/api/`.

## Endpoints

### Conversation

#### POST `/api/conversation`
Send a message and get a response.

**Request Body:**
```json
{
  "message": "Hello, how can you help me?",
  "metadata": {}
}
```

**Response:**
```json
{
  "response": "I can help you with...",
  "goalId": "uuid",
  "taskIds": ["uuid1", "uuid2"],
  "metadata": {
    "agent_id": "WeSpeaker",
    "model_id": "uuid",
    "latency_ms": 1234
  }
}
```

### Streaming

#### POST `/api/stream`
Stream response tokens via Server-Sent Events (SSE).

**Request Body:**
```json
{
  "message": "Tell me a story"
}
```

**Response:** SSE stream with events:
- `{"type":"connected"}` - Connection established
- `{"type":"token","content":"..."}` - Token chunks
- `{"type":"done"}` - Stream complete
- `{"type":"error","error":"..."}` - Error occurred

#### GET `/api/stream?channel=blackboard`
Subscribe to real-time updates via SSE.

**Channels:**
- `user_session` - User conversation updates
- `system_events` - System-wide events
- `blackboard` - Blackboard item updates

### Blackboard

#### GET `/api/blackboard`
Query blackboard items.

**Query Parameters:**
- `type` - Filter by type (user_request, goal, task, etc.)
- `summary` - Search in summary
- `parent_id` - Filter by parent
- `limit` - Limit results (default: 100)
- `offset` - Offset for pagination

**Response:**
```json
{
  "items": [...],
  "count": 10
}
```

#### POST `/api/blackboard`
Create a blackboard item.

**Request Body:**
```json
{
  "type": "goal",
  "summary": "Complete task X",
  "dimensions": {"status": "open", "priority": "high"},
  "links": {"parents": [], "children": []},
  "detail": {}
}
```

#### GET `/api/blackboard/[id]`
Get a specific blackboard item.

#### PUT `/api/blackboard/[id]`
Update a blackboard item.

#### DELETE `/api/blackboard/[id]`
Delete a blackboard item.

### Agents

#### GET `/api/agents`
List all agents.

**Query Parameters:**
- `enabled=true` - Only enabled agents
- `core=true` - Only core agents

**Response:**
```json
{
  "agents": [...],
  "count": 5
}
```

### Models

#### GET `/api/models`
List all models.

**Query Parameters:**
- `enabled=true` - Only enabled models
- `provider=openai` - Filter by provider
- `modality=vision` - Filter by modality

**Response:**
```json
{
  "models": [...],
  "count": 10
}
```

### Events

#### GET `/api/events`
Get recent events.

**Query Parameters:**
- `type` - Filter by event type
- `agent_id` - Filter by agent
- `limit` - Limit results (default: 100)

**Response:**
```json
{
  "events": [...]
}
```

### Health

#### GET `/api/health`
Get system health status.

**Response:**
```json
{
  "status": "healthy",
  "database": "connected",
  "models": {
    "total": 10,
    "enabled": 8,
    "available": 8
  },
  "agents": {
    "total": 8,
    "enabled": 7
  },
  "jobs": {
    "pending": 2,
    "running": 1,
    "failed": 0
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### Initialization

#### POST `/api/init`
Initialize the database and seed initial data.

**Response:**
```json
{
  "status": "ok",
  "message": "Initialization complete"
}
```

## Error Responses

All endpoints return standard HTTP status codes:
- `200` - Success
- `400` - Bad Request
- `404` - Not Found
- `500` - Internal Server Error

Error response format:
```json
{
  "error": "Error message",
  "message": "Detailed error description"
}
```

