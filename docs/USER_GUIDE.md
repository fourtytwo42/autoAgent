# User Guide

## Getting Started

1. Start the development server: `npm run dev`
2. Open http://localhost:3000
3. Initialize the system: Click "Initialize" or call `POST /api/init`

## Main Views

### Conversation
- Chat with the system
- Toggle debug mode to see agent traces and model selections
- View goal/task tree for each conversation

### Blackboard Explorer
- Browse all knowledge items
- Filter by type, search by summary
- View detailed information
- Navigate parent/child relationships

### Agents
- View all agents and their status
- See agent metrics (usage, scores, latency)
- View agent proposals and voting

### Models
- Monitor model performance
- View quality and reliability scores
- Enable/disable models
- See usage statistics

### Timeline
- View system events in real-time
- Filter by type, agent, model
- Navigate to related items

## Features

### Debug Mode
Enable debug mode in the conversation view to see:
- Agent call traces
- Model selection reasoning
- Goal/task trees

### Real-Time Updates
The system provides real-time updates via SSE:
- Blackboard items update automatically
- Events stream to timeline
- Agent activity visible in real-time

## Tips

- Use the blackboard explorer to understand system state
- Check the timeline to see what's happening
- Monitor model dashboard for performance
- Review agent proposals for system evolution

