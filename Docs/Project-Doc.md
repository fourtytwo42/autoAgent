
---

# 0. Updated System Vision

> A persistent, self-evolving LLM hive that:
>
> * runs over **multiple models + providers** via a unified model layer,
> * uses a **multi-dimensional blackboard** and **goal-based agent society**,
> * has a **Next.js frontend** for live introspection and control,
> * stores all persistent state in **Postgres**,
> * supports **parallel, streaming** multi-model calls,
> * and can **evaluate and evolve its own architecture** over time.

The system:

* Helps users with tasks.
* Pursues its own self-goals (maintenance, improvement, exploration).
* Runs on top of a configurable set of models from:

  * **Ollama** (local),
  * **LM Studio** (local),
  * **OpenAI**,
  * **Anthropic**,
  * **Groq**.

You can:

* Add/remove models to the **Model Registry**.
* See which models are used where.
* Watch agents thinking, goals evolving, and the blackboard updating in real time.

---

# 1. Global Architecture Overview

## 1.1 Major Components

1. **Next.js App (Frontend + API routes)**

   * App Router (e.g. `/app` directory).
   * Client UI for:

     * Conversations (user requests / WeSpeaker outputs),
     * Live blackboard explorer,
     * Agent registry viewer,
     * Model dashboard,
     * Task/goal timeline.
   * Streaming via:

     * Server-Sent Events (SSE) or
     * WebSockets (e.g., `socket.io` or `ws`).

2. **Backend Orchestrator (inside Next.js or separate Node service)**

   * Core scheduler loop.
   * Agent runtime: decides which agents to spawn/run.
   * Blackbox to the frontend, exposed via API endpoints and streaming channels.
   * Handles concurrency and multi-model calls.

3. **Model Layer / Provider Abstraction**

   * Unified interface for:

     * `generateText(...)`
     * `generateStreamingText(...)`
     * `generateVision(...)`
     * `generateImage(...)` (if supported or via tools).
   * Provider adapters:

     * OpenAI (chat/completions),
     * Anthropic,
     * Groq,
     * Ollama (local server),
     * LM Studio (local API).
   * Model registry in Postgres.

4. **Blackboard Store (Postgres-backed)**

   * Multi-dimensional blackboard entities:

     * `user_request`, `goal`, `task`, `agent_output`, `judgement`, `agent_proposal`, `architecture_vote`, `memory_entry`, `metric`, etc.
   * Indexed fields for fast querying.
   * Heavy content in JSONB / blobs.

5. **Agent Registry (Postgres)**

   * Definitions of agent types (roles).
   * Metrics for each agent.
   * Permissions and interests.

6. **Job/Task Queue**

   * Could be:

     * PG-based job table,
     * Or lightweight queue (e.g. node worker loop pulling from DB).
   * Ensures reliable scheduling with retries & timeouts.

7. **Tools / MCP Layer (optional but recommended)**

   * For external capabilities:

     * Web search,
     * File system,
     * Custom APIs.
   * Exposed to the LLM as a single “tool search + tool call” meta-tool.

8. **Observability**

   * Event log table in Postgres (or dedicated log store).
   * Metrics outward (Prometheus-style, or just PG + dashboards).
   * Frontend views for debugging & introspection.

---

# 2. Model & Provider Integration

## 2.1 Model Registry (DB)

Postgres table: `models`

```sql
CREATE TABLE models (
  id                UUID PRIMARY KEY,
  name              TEXT NOT NULL,       -- "gpt-4.5-reasoning", "llama3-70b", etc.
  provider          TEXT NOT NULL,       -- "openai", "anthropic", "groq", "ollama", "lmstudio"
  display_name      TEXT NOT NULL,       -- human-friendly label
  is_enabled        BOOLEAN NOT NULL DEFAULT TRUE,
  modalities        TEXT[] NOT NULL,     -- e.g. ['text', 'vision', 'image_gen']
  context_window    INTEGER,             -- tokens
  avg_latency_ms    INTEGER,             -- last known moving average
  cost_per_1k_tokens NUMERIC,            -- approximate, if known
  quality_score     NUMERIC,             -- manual or learned rating 0-1
  reliability_score NUMERIC,             -- uptime/success rate 0-1
  last_benchmarked_at TIMESTAMPTZ,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);
```

You configure:

* Provider credentials (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc.).
* For **Ollama** and **LM Studio**:

  * host URL (often `http://localhost:11434` for Ollama, LM Studio’s HTTP port).
  * available models.

## 2.2 Unified Model Interface

In TypeScript:

```ts
interface ModelConfig {
  id: string;
  name: string;
  provider: 'openai' | 'anthropic' | 'groq' | 'ollama' | 'lmstudio';
  modalities: ('text' | 'vision' | 'image_gen')[];
  contextWindow?: number;
  qualityScore: number;
  reliabilityScore: number;
  metadata: Record<string, any>;
}

interface ModelExecutionOptions {
  temperature?: number;
  maxTokens?: number;
  streaming?: boolean;
  tools?: ToolDefinition[];
}

interface ModelExecutor {
  generateText(
    model: ModelConfig,
    messages: ChatMessage[],
    options?: ModelExecutionOptions
  ): Promise<string>;

  generateTextStream(
    model: ModelConfig,
    messages: ChatMessage[],
    options?: ModelExecutionOptions
  ): AsyncIterable<string>;

  generateVision?(
    model: ModelConfig,
    messages: ChatMessageWithImages[],
    options?: ModelExecutionOptions
  ): Promise<string>;

  generateImage?(
    model: ModelConfig,
    prompt: string,
    options?: { size?: string }
  ): Promise<ImageResult>;
}
```

Backend chooses model(s) via a **Model Router** (described below).

## 2.3 Model Capability & Ranking

You want:

* Many models,
* The ability to select per-agent or per-task,
* And some way to know **how capable** each model is.

Design:

### 2.3.1 Manual/Static Metadata

You can seed initial `quality_score`, `cost_per_1k_tokens`, and `modalities` manually:

* e.g., “gpt-4.5-reasoning” → high quality_score, higher cost.
* local `ollama/llama3-8b` → medium quality, zero marginal cost.

### 2.3.2 System-Learned Metrics (Auto-Benchmarking)

Let the hive refine its understanding:

* For each model, track:

  * **Average judgement scores** across tasks (from Judge agents),
  * **Failure rate** (timeouts, invalid JSON, etc.),
  * **Latency** (moving average),
  * **Per-domain performance** (e.g., “code”, “design”, “math” via topic tags).

Postgres table: `model_metrics` (or just fields on `models` + `metric` items in blackboard).

Update pipeline:

1. Each time a task is executed by an agent using model X:

   * The output gets judged → a `judgement` is written.
2. A `ModelEvaluator` agent (plus runtime logic) aggregates scores per model periodically.
3. Update `models.quality_score` / `reliability_score` with moving averages.

### 2.3.3 Who decides ranking?

**Hybrid approach (recommended):**

* You **seed** initial ratings manually.
* The system’s **Judge + ModelEvaluator** agents update scores over time.
* Constitution can say:

  * “Never use unvetted models for certain safety-critical agents,” etc.
* You can always override via configuration if the system misjudges.

## 2.4 Model Router (which model for which agent?)

Each agent type has default model preferences:

Postgres table: `agent_model_prefs`

```sql
CREATE TABLE agent_model_prefs (
  id           UUID PRIMARY KEY,
  agent_id     TEXT NOT NULL REFERENCES agent_types(id),
  model_id     UUID NOT NULL REFERENCES models(id),
  priority     INTEGER NOT NULL,      -- 1 is highest
  weight       NUMERIC NOT NULL,      -- for randomization
  created_at   TIMESTAMPTZ DEFAULT now()
);
```

Routing logic (simplified):

* For a given agent:

  * Gather its preferred model list (ordered by `priority`).
  * Filter by:

    * `is_enabled`,
    * required modalities (e.g., needs `vision`),
    * context window and cost constraints.
  * Adjust ranking based on:

    * `quality_score`,
    * latency,
    * reliability,
    * domain-specific metrics (topic tags).
* Choose:

  * **Single best model**, or
  * **Multiple models in parallel** (for “ensemble” calls).

## 2.5 Parallel Calls & Ensembles

You want:

* Many models available,
* Parallel calls across providers.

Design pattern:

* For critical or ambiguous tasks (e.g. planning, judging), the agent runtime can:

  * Call multiple models in parallel with the same prompt.
  * Use a **ConsensusAgent** (same base LLM, or one of the providers) to:

    * Compare outputs,
    * Merge into consensus,
    * Or choose the best candidate.

TypeScript pseudo:

```ts
async function ensembleCall(models: ModelConfig[], messages: ChatMessage[]) {
  const promises = models.map(m => executor.generateText(m, messages));
  const results = await Promise.allSettled(promises);

  const successful = results
    .map((r, i) => (r.status === 'fulfilled' ? { model: models[i], text: r.value } : null))
    .filter(Boolean);

  // Then feed to a ConsensusAgent or Judge agent for selection/merge.
}
```

The hive itself can decide when ensemble is worth the cost (e.g., via special agents or flags).

---

# 3. Postgres Schema: Blackboard & Agents

High-level tables (some already sketched; here’s a more structured view).

## 3.1 `blackboard_items`

Single wide table with typed items:

```sql
CREATE TABLE blackboard_items (
  id            UUID PRIMARY KEY,
  type          TEXT NOT NULL,              -- 'user_request', 'goal', 'task', etc.
  summary       TEXT NOT NULL,
  dimensions    JSONB NOT NULL,             -- indexed, for filter
  links         JSONB NOT NULL,             -- e.g. { "parents": [...], "children": [...] }
  detail        JSONB,                      -- can be null; deep content
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ON blackboard_items ((dimensions->>'type'));
CREATE INDEX ON blackboard_items USING GIN (dimensions jsonb_path_ops);
CREATE INDEX ON blackboard_items USING GIN (links jsonb_path_ops);
```

Alternative: separate tables per type, but one table with `type` + JSONB is more flexible.

## 3.2 `agent_types`

```sql
CREATE TABLE agent_types (
  id            TEXT PRIMARY KEY,    -- 'WeSpeaker', 'TaskPlanner', etc.
  description   TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  modalities    TEXT[] NOT NULL,
  interests     JSONB NOT NULL,     -- e.g. { "type": ["goal"], "topic": ["logo"] }
  permissions   JSONB NOT NULL,     -- e.g. { "can_use_tools": [...], "can_create_goals": true }
  is_core       BOOLEAN NOT NULL DEFAULT FALSE,
  is_enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
```

## 3.3 `agent_metrics`

```sql
CREATE TABLE agent_metrics (
  agent_id      TEXT PRIMARY KEY REFERENCES agent_types(id),
  usage_count   BIGINT NOT NULL DEFAULT 0,
  avg_score     NUMERIC,
  avg_latency_ms INTEGER,
  last_used_at  TIMESTAMPTZ
);
```

## 3.4 `jobs` (Scheduler / Task Queue)

```sql
CREATE TABLE jobs (
  id            UUID PRIMARY KEY,
  type          TEXT NOT NULL,            -- 'run_agent', 'maintenance_tick', 'benchmark_model'
  payload       JSONB NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
  attempts      INTEGER NOT NULL DEFAULT 0,
  max_attempts  INTEGER NOT NULL DEFAULT 3,
  scheduled_for TIMESTAMPTZ DEFAULT now(),
  locked_at     TIMESTAMPTZ,
  locked_by     TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ON jobs (status, scheduled_for);
```

Runtime runs a worker loop that pops `pending` jobs and processes them.

---

# 4. Runtime & Scheduler Design

## 4.1 Scheduler Loop

* Can be:

  * A Next.js API route triggered via CRON or internal timer,
  * Or a separate Node service reading from DB.

Responsibilities:

1. **Goal Selection (Steward)**

   * Periodically enqueue a `run_agent` job for Stewards.
   * Stewards:

     * Call `blackboard.overview`,
     * Decide which goals to focus on next,
     * Write `allocation` data back (as a blackboard item or metric).

2. **Task Creation (TaskPlanner & GoalRefiner)**

   * For open goals lacking tasks, enqueue `run_agent` for TaskPlanner / GoalRefiner.
   * They create tasks based on goals.

3. **Task Assignment (TaskExecutor & others)**

   * Worker loop:

     * Finds tasks with `status: pending`.
     * Matches them to agent types whose `interests` fit.
     * Enqueues `run_agent` jobs for those agents.

4. **Model Execution**

   * `run_agent` job calls:

     * Model Router → pick model(s),
     * ModelExecutor → run call(s),
     * Writes `agent_output` item.

5. **Judging & Metrics**

   * For each `agent_output` awaiting judgement:

     * Enqueue `run_agent` for Judge.
     * Judge writes `judgement` items.
   * Periodically:

     * ModelEvaluator agent aggregates `judgement`s → updates model & agent metrics.

6. **Architecture Evolution & Maintenance**

   * Run ArchitectureEngineer & MemoryCurator on a schedule or trigger.

## 4.2 Parallelism & Streaming

* Jobs execute concurrently:

  * Node’s event loop + concurrency config.
* For streaming:

  * ModelExecutor uses streaming APIs where available.
  * Streams are:

    * Aggregated if multiple models are used (e.g., only stream chosen candidate),
    * Or tagged by model in a debug view.

For user-facing conversations:

* The WeSpeaker agent uses streaming model calls.
* The orchestrator pipes streaming tokens via:

  * SSE endpoint (`/api/stream`) or
  * WebSocket channels.

---

# 5. Next.js Frontend: Visualization & Control

No auth (per your instruction), so complete access in dev environment.

## 5.1 Main Views

### 5.1.1 Conversation / Console View

Route: `/`

Features:

* Chat interface:

  * User messages (text + file/image uploads).
  * Hive responses (WeSpeaker outputs).
* “Advanced” panel:

  * Shows which goals & tasks were spawned by each user message.
  * Allows toggling **debug** mode:

    * Show agent call traces,
    * Show model choices.

### 5.1.2 Blackboard Explorer

Route: `/blackboard`

Features:

* Multi-column layout:

  * Left: **filters** (type, topic, status, time range).
  * Middle: list of **matching items** (summary view).
  * Right: **detail panel** for selected item:

    * summary,
    * dimensions,
    * links (clickable),
    * full detail JSON (prettified),
    * timeline of changes (if versioned).

Interactions:

* Click on links to navigate to parent/child/related items.
* “Time scrubber” to see the blackboard at different points.
* Search across summaries and dimensions (full-text + structured).

### 5.1.3 Agents & Architecture View

Route: `/agents`

Features:

* Table of `agent_types`:

  * id, description, is_core, is_enabled, modalities.
  * metrics: usage_count, avg_score, avg_latency.
* Click an agent:

  * See full system prompt,
  * Interests JSON,
  * Permissions (tools, goal creation),
  * Model preferences (from `agent_model_prefs`).
* “Live activity”:

  * Last N invocations,
  * Link to corresponding `agent_output` items in blackboard.

Also display:

* **Agent Proposals** (`agent_proposal` items):

  * List of pending/approved/rejected.
  * Each shows:

    * Proposed prompt,
    * Reasoning,
    * Vote breakdown from Judges.

### 5.1.4 Model Dashboard

Route: `/models`

Features:

* List of models (from `models` table):

  * Name, provider, is_enabled,
  * modalities,
  * context window,
  * cost estimate,
  * quality_score, reliability_score,
  * last_benchmarked_at.
* Graphs:

  * Score vs time,
  * Latency vs time,
  * Usage count per model, per domain (topic).
* Detail view:

  * For a model:

    * Which agents prefer it,
    * Logs of ensemble calls where it participated,
    * Judgement-based metrics.

Controls:

* Enable/disable models.
* Adjust manual weights (e.g., base qualityScore).

### 5.1.5 Timeline / Event Stream

Route: `/timeline`

Features:

* Live event timeline:

  * “Goal created,”
  * “Task created/updated,”
  * “Agent X ran using model Y,”
  * “Judgement written,”
  * “AgentProposal approved,” etc.
* Filters:

  * event type,
  * agent,
  * model,
  * goal/task id.
* Clicking an event:

  * Jumps you to relevant items in Blackboard Explorer / Agents view.

## 5.2 Streaming UI

Use:

* SSE via `/api/stream` or WebSockets.

Events:

* `user_session` channel:

  * Streams tokens from WeSpeaker’s model stream.
* `system_events` channel:

  * Streams high-level events:

    * new goals,
    * agent runs,
    * architecture changes.

UI:

* Chat messages show token-by-token streaming (classic chat UX).
* Debug panels show “live logs” of agent calls (append scroll).

---

# 6. “Ease of Use but Robust & Hardened” Considerations

## 6.1 Robustness

* **Timeouts** for model calls:

  * Per provider config (e.g., 30s–120s).
* **Retries**:

  * Jobs retried up to `max_attempts` with backoff.
* **Dead-letter handling**:

  * Jobs marked `failed` go to a “Failed Jobs” tab in frontend.
* **Error logging**:

  * Errors go into:

    * `events` table,
    * and maybe console/logging backend.

## 6.2 Isolation

* For now, no auth, but:

  * Keep environment network-restricted (dev / lab).
  * Limit tool capabilities (no raw `shell` tools exposed to arbitrary agents unless you really mean it).

## 6.3 Configuration Management

* `.env` for:

  * provider API keys,
  * DB connection,
  * concurrency settings.
* Frontend “Settings” view:

  * Show loaded env-based config (redacting secrets).
  * Show model catalog and toggles.

## 6.4 Debuggability

* Almost everything is written as blackboard items:

  * You can always go see what happened and why.
* Every agent run:

  * Should log:

    * agent_id,
    * model used,
    * input summary,
    * truncated output,
    * latency,
    * result link (agent_output id).

---

# 7. How the Hive Uses Multiple Models in Practice

Example flow for a complex task:

1. User asks: “Design me a new logo and write brand copy.”
2. System:

   * Creates `goal` (user).
   * Stewards prioritize it.
   * TaskPlanner splits:

     * `task-1`: analyze current brand materials (text-heavy).
     * `task-2`: propose 3 visual logo directions (vision + design).
     * `task-3`: write brand copy (text creative).
3. Model routing:

   * For TaskPlanner:

     * Use a high-quality reasoning model (e.g. GPT/Anthropic).
   * For design tasks:

     * Use a cheaper model or a creativity-optimized one if configured.
   * For copy:

     * Maybe ensemble of 2 models, with ConsensusAgent picking best.

Because you have a Model Dashboard, you can see:

* Which models were used,
* How they scored,
* How long they took.

The system can later decide:

* “Model X is too slow for TaskPlanner; switch to Y for similar tasks,”
* via ModelEvaluator + AgentModelPrefs updates.

---

# 8. Implementation Notes & Phasing (Still High-Level, Not MVP Code)

You asked not to minimize to MVP, so this is the conceptual design. But practical phases might be:

1. Core DB schema + model registry + single-provider hive.
2. Add multi-provider model layer + routing.
3. Add basic blackboard explorer + agents view.
4. Add parallel/ensemble support.
5. Add architecture evolution (agent_proposal + votes).
6. Add full observability dashboards.

But the doc above is the “full” target state: multi-model, multi-provider, introspectable hive, streaming UI, robust scheduling, self-goals, and architecture evolution.

---
