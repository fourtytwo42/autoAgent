import { BaseJobProcessor } from './base.processor';
import { Job, JobType, RunAgentJobPayload } from '@/src/types/jobs';
import { agentRegistry } from '@/src/agents/registry';
import { WeSpeakerAgent } from '@/src/agents/agents/wespeaker.agent';
import { TaskPlannerAgent } from '@/src/agents/agents/taskPlanner.agent';
import { JudgeAgent } from '@/src/agents/agents/judge.agent';
import { StewardAgent } from '@/src/agents/agents/steward.agent';
import { ModelEvaluatorAgent } from '@/src/agents/agents/modelEvaluator.agent';
import { ConsensusAgent } from '@/src/agents/agents/consensus.agent';
import { ArchitectureEngineerAgent } from '@/src/agents/agents/architectureEngineer.agent';
import { MemoryCuratorAgent } from '@/src/agents/agents/memoryCurator.agent';
import { WorkerAgent } from '@/src/agents/agents/worker.agent';
import { GoalRefinerAgent } from '@/src/agents/agents/goalRefiner.agent';
import { ResearchWorkerAgent } from '@/src/agents/agents/researchWorker.agent';
import { WritingWorkerAgent } from '@/src/agents/agents/writingWorker.agent';
import { AnalysisWorkerAgent } from '@/src/agents/agents/analysisWorker.agent';
import { blackboardService } from '@/src/blackboard/service';
import { agentMetricsRepository } from '@/src/db/repositories/agentMetrics.repository';
import { eventsRepository } from '@/src/db/repositories/events.repository';
import { taskManager } from '@/src/orchestrator/taskManager';
import { checkTaskCompletion } from './taskCompletion';
import { cleanupCompletedTasks, cleanupStuckJobs } from './taskCleanup';
import { jobQueue } from '@/src/jobs/queue';

export class RunAgentProcessor extends BaseJobProcessor {
  type: JobType = 'run_agent';

  async process(job: Job): Promise<void> {
    const payload = job.payload as RunAgentJobPayload;

    if (!payload.agent_id) {
      throw new Error('agent_id is required in job payload');
    }

    // Load agent type
    const agentType = await agentRegistry.getAgent(payload.agent_id);
    if (!agentType) {
      throw new Error(`Agent ${payload.agent_id} not found`);
    }

    // Create agent instance (simplified - in production would use factory)
    let agent: any;
    switch (payload.agent_id) {
      case 'GoalRefiner':
        agent = new GoalRefinerAgent(agentType);
        break;
      case 'WeSpeaker':
        agent = new WeSpeakerAgent(agentType);
        break;
      case 'TaskPlanner':
        agent = new TaskPlannerAgent(agentType);
        break;
      case 'Judge':
        agent = new JudgeAgent(agentType);
        break;
      case 'Steward':
        agent = new StewardAgent(agentType);
        break;
      case 'ModelEvaluator':
        agent = new ModelEvaluatorAgent(agentType);
        break;
      case 'ConsensusAgent':
        agent = new ConsensusAgent(agentType);
        break;
      case 'ArchitectureEngineer':
        agent = new ArchitectureEngineerAgent(agentType);
        break;
      case 'MemoryCurator':
        agent = new MemoryCuratorAgent(agentType);
        break;
      case 'Worker':
        agent = new WorkerAgent(agentType);
        break;
      case 'ResearchWorker':
        agent = new ResearchWorkerAgent(agentType);
        break;
      case 'WritingWorker':
        agent = new WritingWorkerAgent(agentType);
        break;
      case 'AnalysisWorker':
        agent = new AnalysisWorkerAgent(agentType);
        break;
      default:
        throw new Error(`Unknown agent type: ${payload.agent_id}`);
    }

    // Execute agent
    const context = {
      agent_id: payload.agent_id,
      model_id: payload.model_id || '',
      input: payload.context || {},
      options: payload.options,
    };

    console.log(`[RunAgentProcessor] Executing agent ${payload.agent_id}${payload.context?.goal_id ? ` for goal ${payload.context.goal_id}` : ''}`);
    
    // Update task status to "working" BEFORE executing agent (if this is a task)
    const taskId = payload.context?.task_id;
    if (taskId) {
      try {
        const task = await blackboardService.findById(taskId);
        if (task && task.dimensions?.status !== 'completed' && task.dimensions?.status !== 'working') {
          // Preserve assigned_agent and assigned_agents when updating to working
          await blackboardService.update(taskId, {
            dimensions: {
              ...(task.dimensions || {}),
              status: 'working',
              // Ensure assigned_agent is set if we have one in the payload
              assigned_agent: task.dimensions?.assigned_agent || payload.agent_id,
              assigned_agents: task.dimensions?.assigned_agents || [payload.agent_id],
            },
          });
          console.log(`[RunAgentProcessor] Updated task ${taskId} status to working (before agent execution) with assigned agent: ${payload.agent_id}`);
        }
      } catch (error) {
        console.error(`[RunAgentProcessor] Error updating task status to working:`, error);
      }
    }
    
    const output = await agent.execute(context);

    console.log(`[RunAgentProcessor] Agent ${payload.agent_id} completed, output length: ${output.output?.length || 0}`);

    // Special handling for TaskPlanner - parse output and create tasks
    if (payload.agent_id === 'TaskPlanner' && payload.context?.goal_id) {
      console.log(`[RunAgentProcessor] TaskPlanner completed for goal ${payload.context.goal_id}`);
      console.log(`[RunAgentProcessor] TaskPlanner output preview: ${(output.output || '').substring(0, 300)}`);
      await this.handleTaskPlannerOutput(output, payload.context.goal_id as string);
      // TaskPlanner output is saved inside handleTaskPlannerOutput, so skip the normal save below
    }

    // Save agent output to blackboard
    const goalId = payload.context?.goal_id;
    
    if (taskId) {
      // Save output linked to task
      try {
        console.log(`[RunAgentProcessor] Saving output for task ${taskId} from agent ${payload.agent_id}`);
        const agentOutput = await blackboardService.createAgentOutput(
          output.agent_id,
          output.model_id,
          taskId,
          output.output,
          output.metadata
        );

        console.log(`[RunAgentProcessor] Created agent output ${agentOutput.id} for task ${taskId}`);

        // Schedule Judge to evaluate this output
        await jobQueue.createRunAgentJob(
          'Judge',
          {
            agent_output_id: agentOutput.id,
            agent_output: output.output,
            task_id: taskId,
            agent_id: output.agent_id,
            web_enabled: payload.context?.web_enabled ?? false,
          }
        );

        // Check if all agents working on this task have completed
        const taskCompleted = await checkTaskCompletion(taskId);
        
        if (taskCompleted) {
          console.log(`[RunAgentProcessor] Task ${taskId} marked as completed`);
        } else {
          // Log that task is still pending (might be waiting for other agents)
          console.log(`[RunAgentProcessor] Task ${taskId} still pending - waiting for other agents or dependencies`);
        }
      } catch (error) {
        console.error(`[RunAgentProcessor] Error saving agent output for task ${taskId}:`, error);
        // Still try to check task completion even if output save failed
        try {
          await checkTaskCompletion(taskId);
        } catch (checkError) {
          console.error(`[RunAgentProcessor] Error checking task completion for ${taskId}:`, checkError);
        }
      }
    } else if (goalId && payload.agent_id === 'WeSpeaker') {
      // Save WeSpeaker output linked to goal (for task completion responses)
      try {
        console.log(`[RunAgentProcessor] Saving WeSpeaker output for goal ${goalId}`);
        const agentOutput = await blackboardService.create({
          type: 'agent_output',
          summary: `Output from ${output.agent_id}`,
          dimensions: {
            agent_id: output.agent_id,
            model_id: output.model_id,
            status: 'completed',
            goal_id: goalId,
            ...output.metadata,
          },
          links: {
            parents: [goalId],
          },
          detail: {
            content: output.output,
          },
        });
        
        console.log(`[RunAgentProcessor] Created WeSpeaker output ${agentOutput.id} for goal ${goalId}`);
        
        // Schedule Judge to evaluate this output
        await jobQueue.createRunAgentJob(
          'Judge',
          {
            agent_output_id: agentOutput.id,
            agent_output: output.output,
            goal_id: goalId,
            agent_id: output.agent_id,
            web_enabled: payload.context?.web_enabled ?? false,
          }
        );
      } catch (error) {
        console.error(`[RunAgentProcessor] Error saving WeSpeaker output for goal ${goalId}:`, error);
      }
    } else {
      console.log(`[RunAgentProcessor] No task_id or goal_id in payload for agent ${payload.agent_id}, skipping output save`);
    }

    // Update agent metrics
    await agentMetricsRepository.incrementUsage(output.agent_id);
    if (output.latency_ms) {
      await agentMetricsRepository.updateMetrics(output.agent_id, {
        avg_latency_ms: output.latency_ms, // Simplified - should calculate moving average
      });
    }

    // Log event
    await eventsRepository.create({
      type: 'agent_run',
      agent_id: output.agent_id,
      model_id: output.model_id,
      blackboard_item_id: payload.context?.task_id || null,
      job_id: job.id,
      data: {
        latency_ms: output.latency_ms,
        input_summary: output.input_summary,
        output_length: output.output.length,
      },
    });

    // Note: We no longer delete completed tasks - they stay in the blackboard
    // Tasks are only filtered from the UI task list, not deleted from the database
    // if (payload.agent_id === 'WeSpeaker' && payload.context?.cleanup_after && payload.context?.goal_id) {
    //   await cleanupCompletedTasks(payload.context.goal_id);
    // }
    
    // If WeSpeaker answered a user query request, mark it as answered
    if (payload.agent_id === 'WeSpeaker' && payload.context?.user_query_request_id) {
      try {
        const { markUserQueryAnswered } = await import('@/src/blackboard/userQueryHandler');
        // Extract the answer from WeSpeaker's output
        const answer = output.output || '';
        await markUserQueryAnswered(payload.context.user_query_request_id, answer);
        console.log(`[RunAgentProcessor] Marked user query ${payload.context.user_query_request_id} as answered`);
      } catch (error) {
        console.error(`[RunAgentProcessor] Error marking user query as answered:`, error);
      }
    }
  }

  private async handleTaskPlannerOutput(output: any, goalId: string): Promise<void> {
    // Parse TaskPlanner output and create tasks
    // The output can be in various formats: tables, numbered lists, bullet points
    
    console.log(`[TaskPlanner] Processing output for goal ${goalId}`);
    const taskText = (output.output || '').trim();
    console.log(`[TaskPlanner] Output length: ${taskText.length}, first 200 chars: ${taskText.substring(0, 200)}`);
    
    const tasks: Array<{ summary: string; priority: string; agent_count: number; task_type: string; dependencies: number[] }> = [];

    const tryParseJsonTasks = (): any => {
      if (taskText.length === 0) {
        console.log(`[TaskPlanner] Empty output, skipping JSON parse`);
        return null;
      }

      // Try to find JSON object - look for { ... } pattern
      let firstBrace = taskText.indexOf('{');
      let lastBrace = taskText.lastIndexOf('}');
      
      // If no braces found, try to parse the entire text as JSON
      if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
        console.log(`[TaskPlanner] No JSON braces found, trying to parse entire text as JSON`);
        try {
          const parsed = JSON.parse(taskText);
          if (parsed && Array.isArray(parsed.tasks)) {
            console.log(`[TaskPlanner] Successfully parsed JSON from entire text, found ${parsed.tasks.length} tasks`);
            return parsed;
          }
        } catch (e) {
          console.log(`[TaskPlanner] Failed to parse entire text as JSON: ${e}`);
        }
        return null;
      }

      try {
        const jsonString = taskText.slice(firstBrace, lastBrace + 1);
        console.log(`[TaskPlanner] Extracted JSON string (length: ${jsonString.length}), attempting parse...`);
        const parsed = JSON.parse(jsonString);
        if (!parsed || !Array.isArray(parsed.tasks)) {
          console.log(`[TaskPlanner] Parsed JSON but no tasks array found. Keys: ${Object.keys(parsed || {})}`);
          return null;
        }
        console.log(`[TaskPlanner] Successfully parsed JSON, found ${parsed.tasks.length} tasks`);
        return parsed;
      } catch (error) {
        console.error(`[TaskPlanner] Failed to parse TaskPlanner JSON output:`, error);
        return null;
      }
    };

    const jsonResult = tryParseJsonTasks();
    
    if (jsonResult && Array.isArray(jsonResult.tasks)) {
      // Process JSON tasks
      console.log(`[TaskPlanner] Processing ${jsonResult.tasks.length} tasks from JSON`);
      for (let i = 0; i < jsonResult.tasks.length; i++) {
        const rawTask = jsonResult.tasks[i];
        if (!rawTask) {
          console.log(`[TaskPlanner] Skipping null/undefined task at index ${i}`);
          continue;
        }
        const summary = (rawTask.summary || rawTask.description || rawTask.title || '').trim();
        console.log(`[TaskPlanner] Task ${i + 1}: "${summary.substring(0, 80)}..." (length: ${summary.length})`);
        if (summary.length < 10) {
          console.log(`[TaskPlanner] Skipping task ${i + 1} with summary too short: "${summary}"`);
          continue;
        }
        
        // Filter out explanation text, task group descriptions, and non-actionable fragments
        const summaryLower = summary.toLowerCase();
        let skipReason = '';
        if (summaryLower.startsWith('priority') || summaryLower.startsWith('high-priority') || summaryLower.startsWith('medium-priority') || summaryLower.startsWith('low-priority')) {
          skipReason = 'priority description';
        } else if (summaryLower.includes('must be completed before') || summaryLower.includes('are preparatory') || summaryLower.includes('can run in parallel') || summaryLower.includes('focuses on') || summaryLower.includes('these tasks can')) {
          skipReason = 'task group description';
        } else if (summaryLower.startsWith('task ') && (summaryLower.includes('are') || summaryLower.includes('must') || summaryLower.includes('requires') || summaryLower.includes('depends'))) {
          skipReason = 'task dependency description';
        } else if (summaryLower.includes('notes on') || summaryLower.includes('suggested agents') || summaryLower.includes('suggested agent') || summaryLower.includes('example of')) {
          skipReason = 'explanatory text';
        } else if (summaryLower.includes('rationale') || summaryLower.includes('can be deferred') || summaryLower.includes('can run concurrently') || summaryLower.includes('final checks') || summaryLower.includes('parallel tasks') || summaryLower.includes('enhance quality') || summaryLower.includes('essential for') || summaryLower.includes('must finish') || summaryLower.includes('requires completion') || summaryLower.includes('relies on') || summaryLower.includes('depends on') || summaryLower.includes('should align') || summaryLower.includes('requires completion of')) {
          skipReason = 'explanation text';
        } else if (summaryLower.match(/^[a-z\s]+:$/) || summaryLower.match(/^(data sources|automation tips|user interaction|implementation|notes|tips|sources):/i)) {
          skipReason = 'section header';
        } else if (summaryLower.includes('workflow orchestrator') || summaryLower.includes('cache results for') || summaryLower.includes('api for')) {
          skipReason = 'implementation note';
        } else if (summaryLower.match(/^(tripadvisor|yelp|google|booking\.com|expedia|hotels\.com|weedmaps|leafly|noaa|accuweather)/i)) {
          skipReason = 'data source list';
        } else if (summaryLower.match(/^tasks?\s*\d+/)) {
          skipReason = 'task reference';
        } else if (summary.length < 20) {
          skipReason = `too short (${summary.length} chars)`;
        } else if (!summaryLower.match(/\b(create|find|research|write|build|develop|design|plan|organize|prepare|gather|collect|analyze|evaluate|implement|execute|complete|finish|generate|compile|assemble|draft|identify|recommend|provide|list|outline|search|book|reserve|schedule|send|organize|use|compile|estimate|verify|select|format|proofread|deliver)\b/i)) {
          skipReason = 'no action verb';
        }
        
        if (skipReason) {
          console.log(`[TaskPlanner] Skipping invalid task ${i + 1} from JSON: "${summary.substring(0, 60)}..." - reason: ${skipReason}`);
          continue;
        }
        
        console.log(`[TaskPlanner] Accepting task ${i + 1}: "${summary.substring(0, 60)}..."`);

        const priorityLower = (rawTask.priority || '').toString().toLowerCase();
        let taskPriority: 'high' | 'medium' | 'low' = 'medium';
        if (priorityLower.includes('high')) taskPriority = 'high';
        else if (priorityLower.includes('low')) taskPriority = 'low';

        let agentCount = parseInt(rawTask.agent_count, 10);
        if (Number.isNaN(agentCount)) agentCount = 1;
        agentCount = Math.min(Math.max(agentCount, 1), 5);

        let cleanTaskType = (rawTask.task_type || 'general').toString().toLowerCase().trim();
        if (!cleanTaskType) cleanTaskType = 'general';

        const dependencies = Array.isArray(rawTask.dependencies)
          ? rawTask.dependencies
              .map((dep: any) => parseInt(dep, 10))
              .filter((dep: number) => Number.isInteger(dep) && dep > 0)
          : [];

        tasks.push({
          summary: summary.substring(0, 500),
          priority: taskPriority,
          agent_count: agentCount,
          task_type: cleanTaskType,
          dependencies,
        });
      }
    }
    
    console.log(`[TaskPlanner] After JSON parsing: ${tasks.length} tasks found`);
    
    if (tasks.length === 0) {
        // First, try to parse markdown tables
        // Look for table rows with format: | # | Description | Priority | Agent Count | Task Type | ...
        const lines = taskText.split('\n');
        const seenTasks = new Set<string>();
        let inTable = false;
        let headerFound = false;
        let columnMap: Record<string, number> = {}; // Map column names to indices
        
        console.log(`[TaskPlanner] Starting table parsing. Total lines: ${lines.length}`);
      
      for (const line of lines) {
        const trimmed = line.trim();
        
        // Detect table start (header row with "Description" or "| # |")
        if (trimmed.includes('|') && (trimmed.toLowerCase().includes('description') || trimmed.match(/\|\s*#\s*\|/))) {
          inTable = true;
          headerFound = true;
          // Parse header to map column names
          const headerCols = trimmed.split('|').map((col: string) => col.trim().toLowerCase()).filter((col: string) => col.length > 0);
          headerCols.forEach((col: string, idx: number) => {
            if (col.includes('description')) columnMap.description = idx;
            if (col.includes('priority')) columnMap.priority = idx;
            if (col.includes('agent') || col.includes('count')) columnMap.agent_count = idx;
            if (col.includes('type') || col.includes('task type')) columnMap.task_type = idx;
            if (col.includes('depend')) columnMap.dependencies = idx;
            if (col === '#' || col.match(/^\d+$/)) columnMap.number = idx;
          });
          continue;
        }
        
        // Skip separator rows (|---|---|)
        if (inTable && trimmed.match(/^\|[\s\-:]+\|/)) {
          continue;
        }
        
            // Process table rows
            if (inTable && headerFound && trimmed.startsWith('|') && trimmed.endsWith('|')) {
              // Split by pipe and extract columns
              const columns = trimmed.split('|').map((col: string) => col.trim()).filter((col: string) => col.length > 0);
              
              // Need at least 3 columns: #, Description, Priority
              if (columns.length >= 3) {
                let taskNum = columns[columnMap.number ?? 0];
                // Remove markdown formatting from task number (e.g., "**1**" -> "1")
                taskNum = taskNum.replace(/\*\*/g, '').replace(/\*/g, '').trim();
                const description = columns[columnMap.description ?? 1] || '';
                const priority = columns[columnMap.priority ?? 2] || 'medium';
                const agentCountStr = columns[columnMap.agent_count ?? 3] || '1';
                const taskType = columns[columnMap.task_type ?? 4] || 'general';
                const dependenciesStr = columns[columnMap.dependencies ?? 5] || '';
                
                console.log(`[TaskPlanner] Parsing row: taskNum="${taskNum}", description="${description.substring(0, 50)}..."`);
                
                // Skip if not a number (header or invalid row)
                if (!/^\d+$/.test(taskNum)) {
                  console.log(`[TaskPlanner] Skipping row - taskNum "${taskNum}" is not a number`);
                  continue;
                }
            
            // Skip if description is too short or is a header
            if (description.length < 10 || 
                description.toLowerCase().includes('description') ||
                description.includes('---')) {
              continue;
            }
            
            // Clean up markdown formatting
            let cleanDesc = description
              .replace(/\*\*(.+?)\*\*/g, '$1') // Remove bold
              .replace(/\*(.+?)\*/g, '$1') // Remove italic
              .replace(/\[(.+?)\]\(.+?\)/g, '$1') // Remove links
              .replace(/`(.+?)`/g, '$1') // Remove code
              .trim();
            
            // Extract priority from the priority column
            let taskPriority = 'medium';
            const priorityLower = priority.toLowerCase();
            if (priorityLower.includes('high')) {
              taskPriority = 'high';
            } else if (priorityLower.includes('low')) {
              taskPriority = 'low';
            }
            
            // Extract agent count (default to 1)
            let agentCount = 1;
            const agentCountMatch = agentCountStr.match(/\d+/);
            if (agentCountMatch) {
              agentCount = Math.min(Math.max(1, parseInt(agentCountMatch[0])), 5); // Clamp between 1-5
            }
            
            // Extract dependencies (parse task numbers from dependencies column)
            const dependencies: number[] = [];
            if (dependenciesStr && dependenciesStr.trim() && dependenciesStr !== '-') {
              // Extract task numbers (e.g., "Task 4, Task 5" or "4, 5" or "Tasks 4–5")
              const depMatches = dependenciesStr.match(/\d+/g);
              if (depMatches) {
                dependencies.push(...depMatches.map((n: string) => parseInt(n)));
              }
            }
            
            // Extract task type
            let cleanTaskType = taskType.toLowerCase().trim();
            if (!cleanTaskType || cleanTaskType === 'general' || cleanTaskType === '-') {
              // Infer from description
              if (cleanDesc.toLowerCase().match(/\b(research|find|gather|search|look up|investigate)\b/)) {
                cleanTaskType = 'research';
              } else if (cleanDesc.toLowerCase().match(/\b(write|draft|create|compose|document)\b/)) {
                cleanTaskType = 'writing';
              } else if (cleanDesc.toLowerCase().match(/\b(analyze|evaluate|assess|examine|review)\b/)) {
                cleanTaskType = 'analysis';
              } else {
                cleanTaskType = 'general';
              }
            }
            
            // Filter out explanation text, headers, dependency descriptions, implementation notes, and non-actionable fragments
            const descLower = cleanDesc.toLowerCase();
            let skipReason = '';
            if (descLower.startsWith('priority')) {
              skipReason = 'starts with priority';
            } else if (descLower.startsWith('task ') && (descLower.includes('are') || descLower.includes('must') || descLower.includes('requires') || descLower.includes('depends'))) {
              skipReason = 'task dependency description';
            } else if (descLower.includes('rationale') || descLower.includes('can be deferred') || descLower.includes('can run concurrently') || descLower.includes('final checks') || descLower.includes('parallel tasks') || descLower.includes('enhance quality') || descLower.includes('essential for') || descLower.includes('must finish') || descLower.includes('requires completion') || descLower.includes('relies on') || descLower.includes('depends on') || descLower.includes('should align') || descLower.includes('requires completion of')) {
              skipReason = 'explanation text';
            } else if (descLower.match(/^[a-z\s]+:$/) || descLower.match(/^(data sources|automation tips|user interaction|implementation|notes|tips|sources):/i)) {
              skipReason = 'section header';
            } else if (descLower.includes('workflow orchestrator') || descLower.includes('cache results for') || descLower.includes('api for')) {
              skipReason = 'implementation note';
            } else if (descLower.match(/^(tripadvisor|yelp|google|booking\.com|expedia|hotels\.com|weedmaps|leafly|noaa|accuweather)/i)) {
              skipReason = 'data source list';
            } else if (descLower.match(/^tasks?\s*\d+/)) {
              skipReason = 'task reference';
            } else if (cleanDesc.length < 20) {
              skipReason = `too short (${cleanDesc.length} chars)`;
            } else if (!descLower.match(/\b(create|find|research|write|build|develop|design|plan|organize|prepare|gather|collect|analyze|evaluate|implement|execute|complete|finish|generate|compile|assemble|draft|identify|recommend|provide|list|outline|search|book|reserve|schedule)\b/i)) {
              skipReason = 'no action verb';
            }
            
            if (skipReason) {
              console.log(`[TaskPlanner] Skipping task "${cleanDesc.substring(0, 60)}..." - reason: ${skipReason}`);
              continue;
            }
            
            // Create a unique key to avoid duplicates
            const taskKey = cleanDesc.substring(0, 100).toLowerCase();
            if (cleanDesc.length >= 20 && cleanDesc.length < 500 && !seenTasks.has(taskKey)) {
              seenTasks.add(taskKey);
              tasks.push({
                summary: cleanDesc.substring(0, 500),
                priority: taskPriority,
                agent_count: agentCount,
                task_type: cleanTaskType,
                dependencies: dependencies,
              });
            }
          }
        } else if (inTable && trimmed.length > 0 && !trimmed.startsWith('|')) {
          // End of table
          inTable = false;
        }
      }
    }

    // If no table found, try numbered list format: "1. Task description" or "| 1 | Description |"
    if (tasks.length === 0) {
      // Pattern for numbered lists with optional markdown formatting
      const numberedListPattern = /(?:^|\n)\s*(?:\d+\.|\|\s*\d+\s*\|)\s*\*\*(.+?)\*\*\s*[–-]\s*(.+?)(?=\n|$)/g;
      let listMatch;
      while ((listMatch = numberedListPattern.exec(taskText)) !== null) {
        const taskTitle = listMatch[1]?.trim();
        const taskDesc = listMatch[2]?.trim();
        const fullDescription = taskTitle && taskDesc 
          ? `${taskTitle}: ${taskDesc}`
          : taskDesc || taskTitle || '';
        
        if (fullDescription.length > 10) {
          tasks.push({
            summary: fullDescription.substring(0, 500),
            priority: 'medium',
            agent_count: 1,
            task_type: 'general',
            dependencies: [],
          });
        }
      }
    }

    // If still no tasks, try simple numbered list: "1. Description"
    if (tasks.length === 0) {
      const simpleNumberedPattern = /(?:^|\n)\s*(\d+)\.\s+(.+?)(?=\n\s*\d+\.|$)/gs;
      let simpleMatch;
      while ((simpleMatch = simpleNumberedPattern.exec(taskText)) !== null) {
        const taskDesc = simpleMatch[2]?.trim();
        // Remove markdown formatting
        const cleanDesc = taskDesc
          .replace(/\*\*(.+?)\*\*/g, '$1') // Remove bold
          .replace(/\*(.+?)\*/g, '$1') // Remove italic
          .replace(/\[(.+?)\]\(.+?\)/g, '$1') // Remove links
          .trim();
        
        // Infer task type from description
        let taskType = 'general';
        if (cleanDesc.toLowerCase().match(/\b(research|find|gather|search|look up|investigate)\b/)) {
          taskType = 'research';
        } else if (cleanDesc.toLowerCase().match(/\b(write|draft|create|compose|document)\b/)) {
          taskType = 'writing';
        } else if (cleanDesc.toLowerCase().match(/\b(analyze|evaluate|assess|examine|review)\b/)) {
          taskType = 'analysis';
        }
        
        if (cleanDesc.length > 10 && cleanDesc.length < 500) {
          tasks.push({
            summary: cleanDesc,
            priority: 'medium',
            agent_count: 1,
            task_type: taskType,
            dependencies: [],
          });
        }
      }
    }

    // If still no tasks, try bullet points
    if (tasks.length === 0) {
      const bulletPattern = /(?:^|\n)\s*[-*]\s+(.+?)(?=\n\s*[-*]|$)/g;
      let bulletMatch;
      while ((bulletMatch = bulletPattern.exec(taskText)) !== null) {
        const taskDesc = bulletMatch[1]?.trim();
        const cleanDesc = taskDesc
          .replace(/\*\*(.+?)\*\*/g, '$1')
          .replace(/\*(.+?)\*/g, '$1')
          .trim();
        
        // Infer task type from description
        let taskType = 'general';
        if (cleanDesc.toLowerCase().match(/\b(research|find|gather|search|look up|investigate)\b/)) {
          taskType = 'research';
        } else if (cleanDesc.toLowerCase().match(/\b(write|draft|create|compose|document)\b/)) {
          taskType = 'writing';
        } else if (cleanDesc.toLowerCase().match(/\b(analyze|evaluate|assess|examine|review)\b/)) {
          taskType = 'analysis';
        }
        
        if (cleanDesc.length > 10 && cleanDesc.length < 500) {
          tasks.push({
            summary: cleanDesc,
            priority: 'medium',
            agent_count: 1,
            task_type: taskType,
            dependencies: [],
          });
        }
      }
    }

    const goal = await blackboardService.findById(goalId);
    const webEnabled = goal?.dimensions?.web_enabled ?? false;

    console.log(`[TaskPlanner] Total tasks to create: ${tasks.length}`);
    
    // Always save TaskPlanner output to blackboard (linked to goal)
    try {
      await blackboardService.create({
        type: 'agent_output',
        summary: `Output from ${output.agent_id}`,
        dimensions: {
          agent_id: output.agent_id,
          model_id: output.model_id,
          status: 'completed',
          goal_id: goalId,
          ...(output.metadata || {}),
        },
        links: { parents: [goalId] }, // Output is linked to goal (not task) for TaskPlanner
        detail: {
          content: output.output,
        },
      });
      console.log(`[TaskPlanner] Saved output to blackboard for goal ${goalId}`);
    } catch (error) {
      console.error(`[TaskPlanner] Error saving output to blackboard:`, error);
    }
    
    if (tasks.length === 0) {
      console.warn(`[TaskPlanner] No tasks found in output. Output was: ${taskText.substring(0, 500)}`);
      return;
    }

    // Create tasks in the blackboard with dependencies
    // First pass: create all tasks and map task numbers to IDs
    const taskNumberToId = new Map<number, string>();
    const taskDependencyMap = new Map<number, number[]>();
    const createdTaskIds: string[] = [];
    
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const taskNumber = i + 1; // Task numbers are 1-indexed
      
      if (!task.summary.trim()) {
        console.log(`[TaskPlanner] Skipping empty task at index ${i}`);
        continue;
      }
      
      try {
        console.log(`[TaskPlanner] Creating task ${taskNumber}: ${task.summary.substring(0, 50)}`);
        const taskItem = await taskManager.createTask(
          task.summary,
          goalId,
          {
            status: 'pending',
            priority: task.priority,
            source: 'taskplanner',
            agent_count: task.agent_count,
            task_type: task.task_type,
            dependencies: [],
            dependency_task_numbers: task.dependencies,
            task_number: taskNumber, // Store task number for dependency resolution
            web_enabled: webEnabled,
          },
          { autoAssign: false }
        );
        
        const taskId = taskItem.id;
        taskNumberToId.set(taskNumber, taskId);
        taskDependencyMap.set(taskNumber, task.dependencies);
        createdTaskIds.push(taskId);
        console.log(`[TaskPlanner] Created task ${taskNumber} with ID ${taskId}`);

      } catch (error) {
        console.error(`[TaskPlanner] Error creating task ${taskNumber}:`, error);
      }
    }
    
    console.log(`[TaskPlanner] Created ${createdTaskIds.length} tasks for goal ${goalId}`);
    
    // Second pass: resolve dependencies (convert task numbers to task IDs)
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const taskNumber = i + 1;
      const taskId = taskNumberToId.get(taskNumber);
      
      if (!taskId) {
        continue;
      }

      const dependencyNumbers = taskDependencyMap.get(taskNumber) || [];

      if (dependencyNumbers.length > 0) {
        // Resolve dependency task numbers to task IDs
        const dependencyTaskIds = dependencyNumbers
          .map(depNum => taskNumberToId.get(depNum))
          .filter(Boolean) as string[];
        
        if (dependencyTaskIds.length > 0) {
          // Update task with resolved dependency IDs
        const existingTask = await blackboardService.findById(taskId);
          await blackboardService.update(taskId, {
            dimensions: {
              ...(existingTask?.dimensions || {}),
              dependencies: dependencyTaskIds,
              dependency_task_numbers: dependencyNumbers, // Keep numbers for reference
            },
          });
        }
      }

      // Attempt to assign the task now that dependencies are resolved (if any)
      console.log(`[TaskPlanner] Attempting to assign task ${taskId}: ${task.summary.substring(0, 50)}`);
      const assigned = await taskManager.assignAgentToTask(taskId);
      if (assigned) {
        console.log(`[TaskPlanner] Successfully assigned task ${taskId}`);
      } else {
        console.log(`[TaskPlanner] Failed to assign task ${taskId} - may have dependencies or no matching agents`);
      }
    }

    // Output already saved above
  }
}

