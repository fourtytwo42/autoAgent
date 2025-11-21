# Agent Documentation

## Core Agents

### WeSpeaker
**Purpose**: User-facing conversational agent

**Capabilities**:
- Responds to user messages
- Creates goals from user requests
- Can use web search tool

**Model Preferences**: High-quality conversational models

### TaskPlanner
**Purpose**: Breaks down goals into actionable tasks

**Capabilities**:
- Analyzes goals
- Creates task breakdowns
- Considers dependencies

**Interests**: Goals with status 'open'

### Judge
**Purpose**: Evaluates agent outputs

**Capabilities**:
- Scores output quality (0-1)
- Provides feedback
- Creates judgement items

**Interests**: Completed agent outputs

### Steward
**Purpose**: Manages goal prioritization

**Capabilities**:
- Reviews all open goals
- Prioritizes based on importance
- Allocates resources

**Interests**: All goals

### ModelEvaluator
**Purpose**: Evaluates model performance

**Capabilities**:
- Analyzes judgements
- Updates model scores
- Tracks domain-specific performance

**Interests**: Judgements and metrics

### ConsensusAgent
**Purpose**: Merges outputs from multiple models

**Capabilities**:
- Compares model outputs
- Creates consensus
- Selects best candidate

**Interests**: Agent outputs from ensemble calls

### ArchitectureEngineer
**Purpose**: Analyzes and improves system architecture

**Capabilities**:
- Analyzes system architecture
- Proposes new agents
- Evaluates agent proposals

**Interests**: Agent proposals and metrics

### MemoryCurator
**Purpose**: Maintains knowledge base

**Capabilities**:
- Archives old items
- Cleans up redundant data
- Optimizes storage

**Interests**: Completed goals and tasks

## Agent Lifecycle

1. Agent registered in database
2. Agent matched to tasks by InterestMatcher
3. Job created for agent execution
4. Agent executes with selected model
5. Output saved to blackboard
6. Judge evaluates output
7. Metrics updated

## Creating Custom Agents

1. Define agent type in database
2. Create agent class extending BaseAgent
3. Implement execute() method
4. Register in RunAgentProcessor
5. Set model preferences if needed

